"""
Training script for vision model fine-tuning using npcpy.

Supports two modes:
  1. Diffusion fine-tuning via npcpy.ft.diff (train a custom diffusion model
     on your image dataset with captions).
  2. Vision-language SFT via npcpy.ft.sft (fine-tune a causal LM on
     image-caption pairs for vision understanding tasks).

Uses manifest files produced by prepare_dataset.py.
"""

import argparse
import json
import logging
import os
from pathlib import Path
from typing import Optional, Dict, Any, List

from vixynt.config import load_config, save_config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Diffusion fine-tuning
# ---------------------------------------------------------------------------

def train_diffusion(
    manifest_path: str,
    output_dir: str = 'experiments/diffusion',
    image_size: int = 128,
    channels: int = 256,
    timesteps: int = 1000,
    num_epochs: int = 100,
    batch_size: int = 4,
    learning_rate: float = 1e-5,
    checkpoint_frequency: int = 10,
    resume_from: Optional[str] = None,
) -> str:
    """Train a diffusion model on a prepared dataset.

    Args:
        manifest_path: Path to manifest.json from prepare_dataset.
        output_dir: Directory to save model checkpoints.
        image_size: Training image resolution (images are resized).
        channels: UNet channel width.
        timesteps: Number of diffusion timesteps.
        num_epochs: Training epochs.
        batch_size: Batch size.
        learning_rate: Optimizer learning rate.
        checkpoint_frequency: Save checkpoint every N steps.
        resume_from: Path to checkpoint .pt file to resume from.

    Returns:
        Path to the output model directory.
    """
    from npcpy.ft.diff import train_diffusion as npcpy_train_diffusion
    from npcpy.ft.diff import DiffusionConfig

    with open(manifest_path) as f:
        manifest = json.load(f)

    image_paths = [entry['image_path'] for entry in manifest]
    captions = [entry.get('caption', '') for entry in manifest]

    # Filter out entries where image file is missing
    valid = []
    for img, cap in zip(image_paths, captions):
        if Path(img).exists():
            valid.append((img, cap))
        else:
            logger.warning(f"Image not found, skipping: {img}")

    if not valid:
        raise FileNotFoundError("No valid images found in manifest.")

    image_paths, captions = zip(*valid)
    image_paths = list(image_paths)
    captions = list(captions)

    logger.info(
        f"Training diffusion model on {len(image_paths)} images, "
        f"{num_epochs} epochs, image_size={image_size}"
    )

    config = DiffusionConfig(
        image_size=image_size,
        channels=channels,
        timesteps=timesteps,
        num_epochs=num_epochs,
        batch_size=batch_size,
        learning_rate=learning_rate,
        checkpoint_frequency=checkpoint_frequency,
        output_model_path=output_dir,
    )

    model_path = npcpy_train_diffusion(
        image_paths=image_paths,
        captions=captions,
        config=config,
        resume_from=resume_from,
    )

    logger.info(f"Diffusion model saved to {model_path}")
    return model_path


# ---------------------------------------------------------------------------
# Vision-language SFT
# ---------------------------------------------------------------------------

def train_vision_sft(
    manifest_path: str,
    output_dir: str = 'experiments/vision_sft',
    base_model: str = 'google/gemma-3-270m-it',
    format_style: str = 'gemma',
    num_epochs: int = 20,
    batch_size: int = 2,
    learning_rate: float = 3e-5,
    lora_r: int = 8,
    lora_alpha: int = 16,
    validation_split: float = 0.1,
    max_length: int = 512,
) -> str:
    """Fine-tune a vision-language model on image-caption pairs.

    Converts image-caption pairs into input-output format suitable for
    causal language model SFT via npcpy.ft.sft.

    Args:
        manifest_path: Path to manifest.json from prepare_dataset.
        output_dir: Directory to save fine-tuned model.
        base_model: HuggingFace model identifier.
        format_style: Tokenizer format style (gemma, llama, or plain).
        num_epochs: Training epochs.
        batch_size: Per-device batch size.
        learning_rate: Optimizer learning rate.
        lora_r: LoRA rank.
        lora_alpha: LoRA alpha.
        validation_split: Fraction of data for validation.
        max_length: Maximum sequence length.

    Returns:
        Path to the saved model directory.
    """
    from npcpy.ft.sft import run_sft, SFTConfig

    with open(manifest_path) as f:
        manifest = json.load(f)

    # Build input-output pairs: input = image filename/description prompt,
    # output = caption. For text-only SFT the image path serves as context.
    inputs = []
    outputs = []
    for entry in manifest:
        img_name = Path(entry['image_path']).name
        caption = entry.get('caption', '')
        if not caption:
            continue
        inputs.append(f"Describe the image: {img_name}")
        outputs.append(caption)

    if not inputs:
        raise ValueError("No valid caption pairs found in manifest.")

    logger.info(
        f"Training vision-language SFT on {len(inputs)} examples, "
        f"base_model={base_model}"
    )

    config = SFTConfig(
        base_model_name=base_model,
        output_model_path=output_dir,
        lora_r=lora_r,
        lora_alpha=lora_alpha,
        num_train_epochs=num_epochs,
        per_device_train_batch_size=batch_size,
        learning_rate=learning_rate,
        max_length=max_length,
    )

    model_path = run_sft(
        X=inputs,
        y=outputs,
        config=config,
        validation_split=validation_split,
        format_style=format_style,
    )

    logger.info(f"Vision-language SFT model saved to {model_path}")
    return model_path


# ---------------------------------------------------------------------------
# Unified entry point
# ---------------------------------------------------------------------------

def train_from_config(config: Dict[str, Any]) -> str:
    """Run training based on a config dict (loaded from YAML).

    The config must have a 'mode' key set to 'diffusion' or 'vision_sft'.
    """
    mode = config.get('mode', 'diffusion')
    manifest_path = config['manifest_path']
    output_dir = config.get('output_dir', f'experiments/{mode}')

    if mode == 'diffusion':
        return train_diffusion(
            manifest_path=manifest_path,
            output_dir=output_dir,
            image_size=config.get('image_size', 128),
            channels=config.get('channels', 256),
            timesteps=config.get('timesteps', 1000),
            num_epochs=config.get('num_epochs', 100),
            batch_size=config.get('batch_size', 4),
            learning_rate=config.get('learning_rate', 1e-5),
            checkpoint_frequency=config.get('checkpoint_frequency', 10),
            resume_from=config.get('resume_from', None),
        )
    elif mode == 'vision_sft':
        return train_vision_sft(
            manifest_path=manifest_path,
            output_dir=output_dir,
            base_model=config.get('base_model', 'google/gemma-3-270m-it'),
            format_style=config.get('format_style', 'gemma'),
            num_epochs=config.get('num_epochs', 20),
            batch_size=config.get('batch_size', 2),
            learning_rate=config.get('learning_rate', 3e-5),
            lora_r=config.get('lora_r', 8),
            lora_alpha=config.get('lora_alpha', 16),
            validation_split=config.get('validation_split', 0.1),
            max_length=config.get('max_length', 512),
        )
    else:
        raise ValueError(f"Unknown training mode: {mode}. Use 'diffusion' or 'vision_sft'.")


def main():
    parser = argparse.ArgumentParser(
        description='Train vision models using npcpy fine-tuning'
    )
    parser.add_argument(
        '--config', type=str, default=None,
        help='Path to training YAML config file',
    )
    parser.add_argument(
        '--manifest', type=str, default=None,
        help='Path to dataset manifest JSON (overrides config)',
    )
    parser.add_argument(
        '--mode', type=str, default='diffusion',
        choices=['diffusion', 'vision_sft'],
        help='Training mode',
    )
    parser.add_argument(
        '--output-dir', type=str, default=None,
        help='Output directory for model artifacts',
    )
    parser.add_argument(
        '--resume-from', type=str, default=None,
        help='Checkpoint path to resume diffusion training from',
    )
    parser.add_argument(
        '--epochs', type=int, default=None,
        help='Number of training epochs',
    )
    parser.add_argument(
        '--batch-size', type=int, default=None,
        help='Batch size',
    )
    parser.add_argument(
        '--lr', type=float, default=None,
        help='Learning rate',
    )
    parser.add_argument(
        '--image-size', type=int, default=None,
        help='Image size for diffusion training',
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )

    if args.config:
        config = load_config(args.config)
    else:
        config = {}

    # CLI overrides
    if args.manifest:
        config['manifest_path'] = args.manifest
    if args.mode:
        config.setdefault('mode', args.mode)
    if args.output_dir:
        config['output_dir'] = args.output_dir
    if args.resume_from:
        config['resume_from'] = args.resume_from
    if args.epochs:
        config['num_epochs'] = args.epochs
    if args.batch_size:
        config['batch_size'] = args.batch_size
    if args.lr:
        config['learning_rate'] = args.lr
    if args.image_size:
        config['image_size'] = args.image_size

    if 'manifest_path' not in config:
        parser.error("--manifest or config file with manifest_path is required")

    model_path = train_from_config(config)
    print(f"\nTraining complete! Model saved to: {model_path}")


if __name__ == '__main__':
    main()
