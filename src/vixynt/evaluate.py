"""
Evaluation and inference for fine-tuned vision models.

Supports:
  - Generating sample images from trained diffusion models.
  - Computing feature-based similarity metrics between generated
    and reference images using ResNet embeddings.
  - Running inference on vision-language SFT models.
"""

import argparse
import json
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any, Union
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Diffusion model evaluation
# ---------------------------------------------------------------------------

def generate_samples(
    model_path: str,
    num_samples: int = 8,
    output_dir: str = 'figures/samples',
    image_size: int = 128,
) -> List[str]:
    """Generate sample images from a trained diffusion model.

    Args:
        model_path: Path to model_final.pt checkpoint.
        num_samples: Number of images to generate.
        output_dir: Directory to save generated images.
        image_size: Image resolution.

    Returns:
        List of paths to generated images.
    """
    from npcpy.ft.diff import generate_image

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Generating {num_samples} samples from {model_path}...")

    images = generate_image(
        model_path=model_path,
        num_samples=num_samples,
        image_size=image_size,
    )

    if not isinstance(images, list):
        images = [images]

    saved_paths = []
    for i, img in enumerate(images):
        save_path = output_dir / f"sample_{i:04d}.png"
        img.save(save_path)
        saved_paths.append(str(save_path))
        logger.info(f"Saved: {save_path}")

    return saved_paths


def compute_feature_similarity(
    generated_dir: str,
    reference_dir: str,
    resnet_layer: str = 'layer4',
    device: str = 'cpu',
) -> Dict[str, float]:
    """Compute cosine similarity between generated and reference images in feature space.

    Uses ResNet feature embeddings to compare sets of images. Returns
    aggregate metrics: mean pairwise similarity, std, min, and max.

    Args:
        generated_dir: Directory with generated images.
        reference_dir: Directory with reference/training images.
        resnet_layer: ResNet layer for feature extraction.
        device: Torch device.

    Returns:
        Dict with similarity metrics.
    """
    import torch
    from vixynt.resnet_augmentation import ResNetFeatureExtractor

    extractor = ResNetFeatureExtractor(layer=resnet_layer, device=device)

    def load_features(img_dir: str) -> List[torch.Tensor]:
        features = []
        img_dir = Path(img_dir)
        extensions = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
        for p in sorted(img_dir.iterdir()):
            if p.suffix.lower() in extensions:
                try:
                    feat = extractor.extract(Image.open(p).convert('RGB'))
                    features.append(feat.flatten())
                except Exception as e:
                    logger.warning(f"Feature extraction failed for {p}: {e}")
        return features

    gen_features = load_features(generated_dir)
    ref_features = load_features(reference_dir)

    if not gen_features or not ref_features:
        logger.warning("Insufficient images for similarity computation.")
        return {'mean_similarity': 0.0, 'std_similarity': 0.0}

    gen_stack = torch.cat(gen_features, dim=0)
    ref_stack = torch.cat(ref_features, dim=0)

    # Normalize
    gen_norm = gen_stack / gen_stack.norm(dim=1, keepdim=True).clamp(min=1e-8)
    ref_norm = ref_stack / ref_stack.norm(dim=1, keepdim=True).clamp(min=1e-8)

    # Pairwise cosine similarity
    sim_matrix = torch.mm(gen_norm, ref_norm.t())
    similarities = sim_matrix.flatten().cpu().numpy()

    metrics = {
        'mean_similarity': float(np.mean(similarities)),
        'std_similarity': float(np.std(similarities)),
        'min_similarity': float(np.min(similarities)),
        'max_similarity': float(np.max(similarities)),
        'num_generated': len(gen_features),
        'num_reference': len(ref_features),
    }

    return metrics


def evaluate_diffusion(
    model_path: str,
    reference_dir: str,
    num_samples: int = 16,
    output_dir: str = 'experiments/eval',
    image_size: int = 128,
    device: str = 'cpu',
) -> Dict[str, Any]:
    """Full diffusion model evaluation pipeline.

    Generates samples and computes feature-based metrics against references.

    Args:
        model_path: Path to trained diffusion model checkpoint.
        reference_dir: Directory with reference images.
        num_samples: Number of samples to generate.
        output_dir: Base output directory.
        image_size: Image size for generation.
        device: Torch device.

    Returns:
        Evaluation results dict.
    """
    output_dir = Path(output_dir)
    samples_dir = output_dir / 'samples'

    # Generate
    sample_paths = generate_samples(
        model_path=model_path,
        num_samples=num_samples,
        output_dir=str(samples_dir),
        image_size=image_size,
    )

    # Compute metrics
    metrics = compute_feature_similarity(
        generated_dir=str(samples_dir),
        reference_dir=reference_dir,
        device=device,
    )

    results = {
        'model_path': model_path,
        'reference_dir': reference_dir,
        'num_samples': num_samples,
        'sample_paths': sample_paths,
        'metrics': metrics,
    }

    # Save results
    results_path = output_dir / 'eval_results.json'
    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2)
    logger.info(f"Evaluation results saved to {results_path}")

    return results


# ---------------------------------------------------------------------------
# Vision-language SFT inference
# ---------------------------------------------------------------------------

def run_sft_inference(
    model_path: str,
    prompts: List[str],
    max_new_tokens: int = 128,
    temperature: float = 0.7,
) -> List[str]:
    """Run inference on a fine-tuned SFT model.

    Args:
        model_path: Path to the fine-tuned model directory.
        prompts: List of text prompts.
        max_new_tokens: Maximum tokens to generate per prompt.
        temperature: Sampling temperature.

    Returns:
        List of generated responses.
    """
    from npcpy.ft.sft import load_sft_model, predict_sft

    model, tokenizer = load_sft_model(model_path)
    responses = []

    for prompt in prompts:
        response = predict_sft(
            model, tokenizer, prompt,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
        )
        responses.append(response)

    return responses


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='Evaluate fine-tuned vision models'
    )
    subparsers = parser.add_subparsers(dest='command', help='Evaluation mode')

    # -- generate subcommand --
    gen_parser = subparsers.add_parser('generate', help='Generate samples from diffusion model')
    gen_parser.add_argument('--model', type=str, required=True, help='Path to model checkpoint')
    gen_parser.add_argument('--num-samples', type=int, default=8)
    gen_parser.add_argument('--output-dir', type=str, default='figures/samples')
    gen_parser.add_argument('--image-size', type=int, default=128)

    # -- evaluate subcommand --
    eval_parser = subparsers.add_parser('evaluate', help='Full evaluation with metrics')
    eval_parser.add_argument('--model', type=str, required=True, help='Path to model checkpoint')
    eval_parser.add_argument('--reference-dir', type=str, required=True, help='Reference images directory')
    eval_parser.add_argument('--num-samples', type=int, default=16)
    eval_parser.add_argument('--output-dir', type=str, default='experiments/eval')
    eval_parser.add_argument('--image-size', type=int, default=128)
    eval_parser.add_argument('--device', type=str, default='cpu')

    # -- infer subcommand --
    infer_parser = subparsers.add_parser('infer', help='Run SFT model inference')
    infer_parser.add_argument('--model', type=str, required=True, help='Path to SFT model')
    infer_parser.add_argument('--prompt', type=str, nargs='+', required=True, help='Prompts to run')
    infer_parser.add_argument('--max-tokens', type=int, default=128)
    infer_parser.add_argument('--temperature', type=float, default=0.7)

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )

    if args.command == 'generate':
        paths = generate_samples(
            model_path=args.model,
            num_samples=args.num_samples,
            output_dir=args.output_dir,
            image_size=args.image_size,
        )
        print(f"\nGenerated {len(paths)} samples in {args.output_dir}")

    elif args.command == 'evaluate':
        results = evaluate_diffusion(
            model_path=args.model,
            reference_dir=args.reference_dir,
            num_samples=args.num_samples,
            output_dir=args.output_dir,
            image_size=args.image_size,
            device=args.device,
        )
        print(f"\nEvaluation complete:")
        print(f"  Mean similarity: {results['metrics']['mean_similarity']:.4f}")
        print(f"  Std similarity:  {results['metrics']['std_similarity']:.4f}")

    elif args.command == 'infer':
        responses = run_sft_inference(
            model_path=args.model,
            prompts=args.prompt,
            max_new_tokens=args.max_tokens,
            temperature=args.temperature,
        )
        for prompt, response in zip(args.prompt, responses):
            print(f"\n[Prompt] {prompt}")
            print(f"[Response] {response}")

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
