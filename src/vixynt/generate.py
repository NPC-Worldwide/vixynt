"""
Image generation from fine-tuned or cloud-based models via npcpy.

Supports:
  - Generating from a locally trained diffusion checkpoint (npcpy.ft.diff).
  - Generating via cloud providers (OpenAI DALL-E, Gemini, Ollama, Diffusers)
    through npcpy.gen.image_gen.
  - Editing / refining existing images with a provider.
  - Batch generation with optional vision LLM critique for quality filtering.
"""

import argparse
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Union

from PIL import Image

logger = logging.getLogger(__name__)


def generate_from_checkpoint(
    model_path: str,
    num_samples: int = 4,
    image_size: int = 128,
    output_dir: str = 'figures/generated',
) -> List[str]:
    """Generate images from a trained vixynt/npcpy diffusion checkpoint.

    Args:
        model_path: Path to model_final.pt or a checkpoint .pt file.
        num_samples: Number of images to generate.
        image_size: Image resolution.
        output_dir: Directory to save generated images.

    Returns:
        List of saved image file paths.
    """
    from npcpy.ft.diff import generate_image

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Generating {num_samples} images from checkpoint {model_path}")

    images = generate_image(
        model_path=model_path,
        num_samples=num_samples,
        image_size=image_size,
    )
    if not isinstance(images, list):
        images = [images]

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    saved = []
    for i, img in enumerate(images):
        path = output_dir / f"gen_{timestamp}_{i:04d}.png"
        img.save(path)
        saved.append(str(path))

    logger.info(f"Saved {len(saved)} images to {output_dir}")
    return saved


def generate_from_provider(
    prompt: str,
    provider: str = 'gemini',
    model: str = 'gemini-2.0-flash',
    num_images: int = 1,
    height: int = 1024,
    width: int = 1024,
    output_dir: str = 'figures/generated',
    input_images: Optional[List[str]] = None,
    api_key: Optional[str] = None,
) -> List[str]:
    """Generate images using npcpy's multi-provider image generation.

    Supports OpenAI (DALL-E / gpt-image-1), Gemini, Ollama, and
    HuggingFace Diffusers as backends.

    Args:
        prompt: Text prompt for generation.
        provider: Provider backend (openai, gemini, ollama, diffusers).
        model: Model name within the provider.
        num_images: Number of images to generate.
        height: Image height in pixels.
        width: Image width in pixels.
        output_dir: Directory to save generated images.
        input_images: Optional list of image paths for editing/img2img.
        api_key: Optional API key override.

    Returns:
        List of saved image file paths.
    """
    from npcpy.llm_funcs import gen_image

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(
        f"Generating {num_images} images via {provider}/{model}: "
        f"\"{prompt[:80]}...\""
    )

    kwargs = {}
    if api_key:
        kwargs['api_key'] = api_key

    images = gen_image(
        prompt=prompt,
        model=model,
        provider=provider,
        height=height,
        width=width,
        n_images=num_images,
        input_images=input_images,
        **kwargs,
    )

    if not isinstance(images, list):
        images = [images]

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    saved = []
    for i, img in enumerate(images):
        path = output_dir / f"gen_{provider}_{timestamp}_{i:04d}.png"
        if isinstance(img, Image.Image):
            img.save(path)
        else:
            # Some providers may return bytes or paths
            if isinstance(img, bytes):
                with open(path, 'wb') as f:
                    f.write(img)
            elif isinstance(img, str) and Path(img).exists():
                Image.open(img).save(path)
            else:
                logger.warning(f"Unexpected image type: {type(img)}")
                continue
        saved.append(str(path))

    logger.info(f"Saved {len(saved)} images to {output_dir}")
    return saved


def critique_and_filter(
    image_paths: List[str],
    prompt: str,
    model: str = 'gemini-2.0-flash',
    provider: str = 'gemini',
    threshold: float = 0.6,
    api_key: Optional[str] = None,
) -> List[str]:
    """Use a vision LLM to score generated images and filter by quality.

    Asks the vision model to rate each image on a 0-1 scale for how well
    it matches the original generation prompt, then keeps images above
    the threshold.

    Args:
        image_paths: List of generated image file paths.
        prompt: The original generation prompt (used for relevance scoring).
        model: Vision LLM model.
        provider: Vision LLM provider.
        threshold: Minimum score to keep (0-1).
        api_key: Optional API key.

    Returns:
        Filtered list of image paths that passed the quality threshold.
    """
    from npcpy.llm_funcs import get_llm_response

    critique_prompt = (
        f"Rate how well this image matches the following description on a scale "
        f"from 0.0 to 1.0 (where 1.0 is a perfect match). "
        f"Description: \"{prompt}\"\n\n"
        f"Respond with ONLY a number between 0.0 and 1.0, nothing else."
    )

    kept = []
    kwargs = {}
    if api_key:
        kwargs['api_key'] = api_key

    for img_path in image_paths:
        try:
            response = get_llm_response(
                prompt=critique_prompt,
                model=model,
                provider=provider,
                images=[img_path],
                **kwargs,
            )
            text = response.get('response', str(response)) if isinstance(response, dict) else str(response)
            # Extract the first float from the response
            score = None
            for token in text.split():
                try:
                    score = float(token.strip('.,'))
                    if 0.0 <= score <= 1.0:
                        break
                except ValueError:
                    continue

            if score is not None and score >= threshold:
                kept.append(img_path)
                logger.info(f"  KEEP {Path(img_path).name}: score={score:.2f}")
            else:
                logger.info(f"  DROP {Path(img_path).name}: score={score}")
        except Exception as e:
            logger.warning(f"Critique failed for {img_path}: {e}")
            kept.append(img_path)  # keep on failure to avoid data loss

    logger.info(f"Kept {len(kept)}/{len(image_paths)} images (threshold={threshold})")
    return kept


def main():
    parser = argparse.ArgumentParser(
        description='Generate images from fine-tuned or cloud models via npcpy'
    )
    subparsers = parser.add_subparsers(dest='command', help='Generation mode')

    # -- checkpoint subcommand --
    ckpt = subparsers.add_parser(
        'checkpoint', help='Generate from a trained diffusion checkpoint'
    )
    ckpt.add_argument('--model', type=str, required=True, help='Path to model .pt file')
    ckpt.add_argument('--num-samples', type=int, default=4)
    ckpt.add_argument('--image-size', type=int, default=128)
    ckpt.add_argument('--output-dir', type=str, default='figures/generated')

    # -- provider subcommand --
    prov = subparsers.add_parser(
        'provider', help='Generate via a cloud/local provider'
    )
    prov.add_argument('--prompt', type=str, required=True, help='Generation prompt')
    prov.add_argument('--provider', type=str, default='gemini',
                      choices=['openai', 'gemini', 'ollama', 'diffusers'])
    prov.add_argument('--model', type=str, default=None,
                      help='Model name (provider-specific)')
    prov.add_argument('--num-images', type=int, default=1)
    prov.add_argument('--height', type=int, default=1024)
    prov.add_argument('--width', type=int, default=1024)
    prov.add_argument('--output-dir', type=str, default='figures/generated')
    prov.add_argument('--input-images', type=str, nargs='*', default=None,
                      help='Input images for editing/img2img')
    prov.add_argument('--api-key', type=str, default=None)
    prov.add_argument('--critique', action='store_true',
                      help='Run vision LLM quality filter after generation')
    prov.add_argument('--critique-threshold', type=float, default=0.6,
                      help='Minimum quality score to keep (0-1)')

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )

    # Default model per provider
    provider_defaults = {
        'openai': 'gpt-image-1',
        'gemini': 'gemini-2.0-flash',
        'ollama': 'x/z-image-turbo',
        'diffusers': 'runwayml/stable-diffusion-v1-5',
    }

    if args.command == 'checkpoint':
        paths = generate_from_checkpoint(
            model_path=args.model,
            num_samples=args.num_samples,
            image_size=args.image_size,
            output_dir=args.output_dir,
        )
        print(f"\nGenerated {len(paths)} images:")
        for p in paths:
            print(f"  {p}")

    elif args.command == 'provider':
        model = args.model or provider_defaults.get(args.provider, args.provider)
        paths = generate_from_provider(
            prompt=args.prompt,
            provider=args.provider,
            model=model,
            num_images=args.num_images,
            height=args.height,
            width=args.width,
            output_dir=args.output_dir,
            input_images=args.input_images,
            api_key=args.api_key,
        )

        if args.critique and paths:
            paths = critique_and_filter(
                image_paths=paths,
                prompt=args.prompt,
                threshold=args.critique_threshold,
                api_key=args.api_key,
            )

        print(f"\nGenerated {len(paths)} images:")
        for p in paths:
            print(f"  {p}")

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
