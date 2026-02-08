"""
Dataset preparation pipeline for vision model fine-tuning.

Handles image collection, captioning via npcpy vision LLMs, augmentation
using vixynt's ImageAugmentor/ResNetAugmentor, and manifest generation
for downstream training with npcpy.ft.diff.
"""

import argparse
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional, Union
from PIL import Image
import numpy as np
from tqdm import tqdm

from vixynt.config import load_config, save_config
from vixynt.data_augmentation import ImageAugmentor
from vixynt.resnet_augmentation import ResNetAugmentor

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'}


def discover_images(source_dir: Union[str, Path]) -> List[Path]:
    """Recursively find all image files in a directory."""
    source_dir = Path(source_dir)
    images = []
    for path in sorted(source_dir.rglob('*')):
        if path.suffix.lower() in IMAGE_EXTENSIONS and path.is_file():
            images.append(path)
    return images


def caption_image(
    image_path: Union[str, Path],
    model: str = 'gemini-2.0-flash',
    provider: str = 'gemini',
    prompt: str = 'Describe this image in detail for use as a training caption. '
                  'Focus on the main subject, style, colors, composition, and mood.',
    api_key: Optional[str] = None,
) -> str:
    """Generate a caption for an image using npcpy's vision LLM.

    Args:
        image_path: Path to the image file.
        model: Vision model to use.
        provider: LLM provider (gemini, openai, ollama, anthropic).
        prompt: Captioning prompt sent alongside the image.
        api_key: Optional API key override.

    Returns:
        Generated caption string.
    """
    from npcpy.llm_funcs import get_llm_response

    kwargs = {}
    if api_key:
        kwargs['api_key'] = api_key

    response = get_llm_response(
        prompt=prompt,
        model=model,
        provider=provider,
        images=[str(image_path)],
        **kwargs,
    )

    if isinstance(response, dict):
        return response.get('response', response.get('content', str(response)))
    return str(response)


def caption_batch(
    image_paths: List[Path],
    model: str = 'gemini-2.0-flash',
    provider: str = 'gemini',
    prompt: str = 'Describe this image in detail for use as a training caption. '
                  'Focus on the main subject, style, colors, composition, and mood.',
    api_key: Optional[str] = None,
    existing_captions: Optional[Dict[str, str]] = None,
) -> Dict[str, str]:
    """Caption a batch of images, skipping any that already have captions.

    Args:
        image_paths: List of image file paths.
        model: Vision model name.
        provider: LLM provider.
        prompt: Captioning prompt.
        api_key: Optional API key.
        existing_captions: Dict mapping filename -> caption to skip.

    Returns:
        Dict mapping filename -> caption for all images.
    """
    captions = dict(existing_captions or {})
    to_caption = [
        p for p in image_paths if p.name not in captions
    ]

    if not to_caption:
        logger.info("All images already have captions, skipping.")
        return captions

    logger.info(f"Captioning {len(to_caption)} images with {provider}/{model}...")
    for img_path in tqdm(to_caption, desc="Captioning"):
        try:
            caption = caption_image(
                img_path, model=model, provider=provider,
                prompt=prompt, api_key=api_key,
            )
            captions[img_path.name] = caption
        except Exception as e:
            logger.warning(f"Failed to caption {img_path.name}: {e}")
            captions[img_path.name] = ""

    return captions


def augment_dataset(
    image_paths: List[Path],
    output_dir: Union[str, Path],
    num_variations: int = 5,
    use_resnet: bool = True,
    use_basic: bool = True,
    device: str = 'cpu',
    seed: Optional[int] = None,
) -> List[Dict[str, str]]:
    """Generate augmented variations and return metadata linking originals to augments.

    Args:
        image_paths: Original image paths.
        output_dir: Directory to save augmented images.
        num_variations: Number of augmentations per strategy per image.
        use_resnet: Whether to apply ResNet-based augmentation.
        use_basic: Whether to apply basic (noise/compression/blur) augmentation.
        device: Torch device for ResNet augmentor.
        seed: Random seed for reproducibility.

    Returns:
        List of dicts with keys: original, augmented_path, augment_type.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    augment_records = []

    basic_augmentor = None
    resnet_augmentor = None

    if use_basic:
        basic_augmentor = ImageAugmentor(
            num_variations=num_variations, seed=seed,
        )

    if use_resnet:
        resnet_augmentor = ResNetAugmentor(
            num_variations=num_variations, device=device, seed=seed,
        )

    for img_path in tqdm(image_paths, desc="Augmenting"):
        try:
            if basic_augmentor:
                basic_augmentor.generate_variations(
                    img_path, output_dir=output_dir, save_images=True,
                )
                for i in range(num_variations):
                    aug_name = f"{img_path.stem}_aug_{i}{img_path.suffix}"
                    augment_records.append({
                        'original': img_path.name,
                        'augmented_path': str(output_dir / aug_name),
                        'augment_type': 'basic',
                    })

            if resnet_augmentor:
                resnet_augmentor.generate_variations(
                    img_path, output_dir=output_dir, save_images=True,
                )
                for i in range(num_variations):
                    aug_name = f"{img_path.stem}_resnet_aug_{i}{img_path.suffix}"
                    augment_records.append({
                        'original': img_path.name,
                        'augmented_path': str(output_dir / aug_name),
                        'augment_type': 'resnet',
                    })

        except Exception as e:
            logger.warning(f"Augmentation failed for {img_path.name}: {e}")

    return augment_records


def build_manifest(
    image_paths: List[Path],
    captions: Dict[str, str],
    augment_records: Optional[List[Dict[str, str]]] = None,
    include_augmented: bool = True,
) -> List[Dict[str, str]]:
    """Build a training manifest mapping image paths to captions.

    The manifest is a list of {image_path, caption} dicts consumable by
    npcpy.ft.diff.train_diffusion().

    Args:
        image_paths: Original image file paths.
        captions: Mapping of filename -> caption.
        augment_records: Augmentation metadata from augment_dataset().
        include_augmented: Whether to include augmented images in manifest.

    Returns:
        List of {image_path, caption} dicts.
    """
    manifest = []

    for img_path in image_paths:
        caption = captions.get(img_path.name, '')
        manifest.append({
            'image_path': str(img_path),
            'caption': caption,
        })

    if include_augmented and augment_records:
        for record in augment_records:
            original_caption = captions.get(record['original'], '')
            manifest.append({
                'image_path': record['augmented_path'],
                'caption': original_caption,
            })

    return manifest


def prepare_dataset(
    source_dir: str,
    output_dir: str,
    caption_model: str = 'gemini-2.0-flash',
    caption_provider: str = 'gemini',
    caption_prompt: Optional[str] = None,
    num_augmentations: int = 5,
    use_resnet_augmentation: bool = True,
    use_basic_augmentation: bool = True,
    device: str = 'cpu',
    seed: Optional[int] = None,
    skip_captioning: bool = False,
    captions_file: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    """Full dataset preparation pipeline.

    Steps:
        1. Discover images in source_dir.
        2. Generate captions with a vision LLM (or load existing).
        3. Augment images with vixynt augmentors.
        4. Build and save a training manifest.

    Args:
        source_dir: Directory with raw images.
        output_dir: Root output directory for prepared dataset.
        caption_model: Vision LLM model name.
        caption_provider: Vision LLM provider.
        caption_prompt: Custom captioning prompt (uses default if None).
        num_augmentations: Augmented variations per image per strategy.
        use_resnet_augmentation: Enable ResNet-based augmentation.
        use_basic_augmentation: Enable basic augmentation.
        device: Torch device for ResNet features.
        seed: Random seed.
        skip_captioning: Skip the captioning step entirely.
        captions_file: Path to existing captions JSON to load/merge.
        api_key: API key for the captioning provider.

    Returns:
        Path to the saved manifest JSON file.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    augmented_dir = output_dir / 'augmented'
    manifest_path = output_dir / 'manifest.json'
    captions_path = output_dir / 'captions.json'

    # 1. Discover images
    image_paths = discover_images(source_dir)
    if not image_paths:
        raise FileNotFoundError(f"No images found in {source_dir}")
    logger.info(f"Found {len(image_paths)} images in {source_dir}")

    # 2. Captioning
    existing_captions = {}
    if captions_file and Path(captions_file).exists():
        with open(captions_file) as f:
            existing_captions = json.load(f)
        logger.info(f"Loaded {len(existing_captions)} existing captions from {captions_file}")
    elif captions_path.exists():
        with open(captions_path) as f:
            existing_captions = json.load(f)
        logger.info(f"Loaded {len(existing_captions)} existing captions from {captions_path}")

    if skip_captioning:
        captions = existing_captions
    else:
        default_prompt = (
            'Describe this image in detail for use as a training caption. '
            'Focus on the main subject, style, colors, composition, and mood.'
        )
        captions = caption_batch(
            image_paths,
            model=caption_model,
            provider=caption_provider,
            prompt=caption_prompt or default_prompt,
            api_key=api_key,
            existing_captions=existing_captions,
        )

    # Save captions
    with open(captions_path, 'w') as f:
        json.dump(captions, f, indent=2)
    logger.info(f"Saved captions to {captions_path}")

    # 3. Augmentation
    augment_records = []
    if num_augmentations > 0:
        augment_records = augment_dataset(
            image_paths,
            output_dir=augmented_dir,
            num_variations=num_augmentations,
            use_resnet=use_resnet_augmentation,
            use_basic=use_basic_augmentation,
            device=device,
            seed=seed,
        )
        logger.info(
            f"Generated {len(augment_records)} augmented images "
            f"in {augmented_dir}"
        )

    # 4. Build manifest
    manifest = build_manifest(
        image_paths, captions,
        augment_records=augment_records,
        include_augmented=True,
    )

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    logger.info(f"Saved manifest with {len(manifest)} entries to {manifest_path}")

    # Save preparation config for reproducibility
    prep_config = {
        'source_dir': str(source_dir),
        'output_dir': str(output_dir),
        'caption_model': caption_model,
        'caption_provider': caption_provider,
        'num_augmentations': num_augmentations,
        'use_resnet_augmentation': use_resnet_augmentation,
        'use_basic_augmentation': use_basic_augmentation,
        'device': device,
        'seed': seed,
        'num_original_images': len(image_paths),
        'num_augmented_images': len(augment_records),
        'total_manifest_entries': len(manifest),
    }
    save_config(prep_config, str(output_dir / 'prep_config.yaml'))

    return str(manifest_path)


def main():
    parser = argparse.ArgumentParser(
        description='Prepare a vision dataset for fine-tuning with npcpy'
    )
    parser.add_argument(
        '--source-dir', type=str, required=True,
        help='Directory containing raw images to prepare',
    )
    parser.add_argument(
        '--output-dir', type=str, default='data/prepared',
        help='Output directory for the prepared dataset',
    )
    parser.add_argument(
        '--config', type=str, default=None,
        help='Path to YAML config file (overrides CLI args)',
    )
    parser.add_argument(
        '--caption-model', type=str, default='gemini-2.0-flash',
        help='Vision LLM model for captioning',
    )
    parser.add_argument(
        '--caption-provider', type=str, default='gemini',
        help='LLM provider for captioning (gemini, openai, ollama, anthropic)',
    )
    parser.add_argument(
        '--caption-prompt', type=str, default=None,
        help='Custom captioning prompt',
    )
    parser.add_argument(
        '--num-augmentations', type=int, default=5,
        help='Number of augmented variations per image per strategy',
    )
    parser.add_argument(
        '--no-resnet', action='store_true',
        help='Disable ResNet-based augmentation',
    )
    parser.add_argument(
        '--no-basic', action='store_true',
        help='Disable basic augmentation',
    )
    parser.add_argument(
        '--device', type=str, default='cpu',
        help='Torch device for ResNet (cpu or cuda)',
    )
    parser.add_argument(
        '--seed', type=int, default=None,
        help='Random seed for reproducibility',
    )
    parser.add_argument(
        '--skip-captioning', action='store_true',
        help='Skip the captioning step (use existing captions)',
    )
    parser.add_argument(
        '--captions-file', type=str, default=None,
        help='Path to existing captions JSON file',
    )
    parser.add_argument(
        '--api-key', type=str, default=None,
        help='API key for the captioning provider',
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )

    # Load config file if provided (overrides CLI args)
    if args.config:
        config = load_config(args.config)
        source_dir = config.get('source_dir', args.source_dir)
        output_dir = config.get('output_dir', args.output_dir)
        caption_model = config.get('caption_model', args.caption_model)
        caption_provider = config.get('caption_provider', args.caption_provider)
        caption_prompt = config.get('caption_prompt', args.caption_prompt)
        num_augmentations = config.get('num_augmentations', args.num_augmentations)
        use_resnet = config.get('use_resnet_augmentation', not args.no_resnet)
        use_basic = config.get('use_basic_augmentation', not args.no_basic)
        device = config.get('device', args.device)
        seed = config.get('seed', args.seed)
        skip_captioning = config.get('skip_captioning', args.skip_captioning)
        captions_file = config.get('captions_file', args.captions_file)
        api_key = config.get('api_key', args.api_key)
    else:
        source_dir = args.source_dir
        output_dir = args.output_dir
        caption_model = args.caption_model
        caption_provider = args.caption_provider
        caption_prompt = args.caption_prompt
        num_augmentations = args.num_augmentations
        use_resnet = not args.no_resnet
        use_basic = not args.no_basic
        device = args.device
        seed = args.seed
        skip_captioning = args.skip_captioning
        captions_file = args.captions_file
        api_key = args.api_key

    manifest_path = prepare_dataset(
        source_dir=source_dir,
        output_dir=output_dir,
        caption_model=caption_model,
        caption_provider=caption_provider,
        caption_prompt=caption_prompt,
        num_augmentations=num_augmentations,
        use_resnet_augmentation=use_resnet,
        use_basic_augmentation=use_basic,
        device=device,
        seed=seed,
        skip_captioning=skip_captioning,
        captions_file=captions_file,
        api_key=api_key,
    )

    print(f"\nDataset prepared successfully!")
    print(f"Manifest: {manifest_path}")


if __name__ == '__main__':
    main()
