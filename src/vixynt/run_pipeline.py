"""
End-to-end pipeline: prepare dataset -> train model -> evaluate.

Runs the full vixynt workflow from a single YAML config file. Useful for
automated experiments and reproducible runs.
"""

import argparse
import json
import logging
from pathlib import Path
from typing import Dict, Any

from vixynt.config import load_config, save_config

logger = logging.getLogger(__name__)


def run_pipeline(config: Dict[str, Any]) -> Dict[str, Any]:
    """Run the full prepare -> train -> evaluate pipeline.

    Args:
        config: Pipeline configuration dict. Should contain keys for
            the prepare, train, and evaluate stages. At minimum needs
            'source_dir' and 'mode'.

    Returns:
        Dict with results from each pipeline stage.
    """
    from vixynt.prepare_dataset import prepare_dataset
    from vixynt.train import train_from_config
    from vixynt.evaluate import evaluate_diffusion, run_sft_inference

    results = {}

    # ---------------------------------------------------------------
    # Stage 1: Prepare dataset
    # ---------------------------------------------------------------
    source_dir = config.get('source_dir')
    output_dir = config.get('output_dir', 'data/prepared')
    skip_prepare = config.get('skip_prepare', False)

    if skip_prepare and config.get('manifest_path'):
        manifest_path = config['manifest_path']
        logger.info(f"Skipping preparation, using existing manifest: {manifest_path}")
    elif source_dir:
        logger.info("=== Stage 1: Preparing dataset ===")
        manifest_path = prepare_dataset(
            source_dir=source_dir,
            output_dir=output_dir,
            caption_model=config.get('caption_model', 'gemini-2.0-flash'),
            caption_provider=config.get('caption_provider', 'gemini'),
            caption_prompt=config.get('caption_prompt'),
            caption_mode=config.get('caption_mode', 'vision_llm'),
            num_augmentations=config.get('num_augmentations', 5),
            use_resnet_augmentation=config.get('use_resnet_augmentation', True),
            use_basic_augmentation=config.get('use_basic_augmentation', True),
            device=config.get('device', 'cpu'),
            seed=config.get('seed'),
            skip_captioning=config.get('skip_captioning', False),
            captions_file=config.get('captions_file'),
            api_key=config.get('api_key'),
            ocr_model_id=config.get('ocr_model_id', 'unsloth/DeepSeek-OCR'),
        )
        config['manifest_path'] = manifest_path
        results['manifest_path'] = manifest_path
    else:
        if 'manifest_path' not in config:
            raise ValueError(
                "Pipeline config must include 'source_dir' for preparation "
                "or 'manifest_path' to skip preparation."
            )
        manifest_path = config['manifest_path']

    # ---------------------------------------------------------------
    # Stage 2: Train
    # ---------------------------------------------------------------
    skip_train = config.get('skip_train', False)
    mode = config.get('mode', 'diffusion')

    if skip_train and config.get('model_path'):
        model_path = config['model_path']
        logger.info(f"Skipping training, using existing model: {model_path}")
    else:
        logger.info(f"=== Stage 2: Training ({mode}) ===")
        train_config = dict(config)
        train_config['manifest_path'] = manifest_path
        model_path = train_from_config(train_config)
        results['model_path'] = model_path

    # ---------------------------------------------------------------
    # Stage 3: Evaluate
    # ---------------------------------------------------------------
    skip_eval = config.get('skip_eval', False)

    if not skip_eval:
        logger.info("=== Stage 3: Evaluating ===")
        eval_output = config.get('eval_output_dir', 'experiments/eval')

        if mode == 'diffusion':
            # For diffusion, find the model_final.pt
            final_path = Path(model_path) / 'model_final.pt'
            if not final_path.exists():
                final_path = Path(model_path)

            eval_results = evaluate_diffusion(
                model_path=str(final_path),
                reference_dir=source_dir or str(Path(output_dir)),
                num_samples=config.get('eval_num_samples', 16),
                output_dir=eval_output,
                image_size=config.get('image_size', 128),
                device=config.get('device', 'cpu'),
            )
            results['eval'] = eval_results
            logger.info(
                f"Mean similarity: "
                f"{eval_results['metrics']['mean_similarity']:.4f}"
            )

        elif mode == 'vision_sft':
            test_prompts = config.get('eval_prompts', [
                'Describe the image: test.png',
            ])
            responses = run_sft_inference(
                model_path=model_path,
                prompts=test_prompts,
                max_new_tokens=config.get('eval_max_tokens', 128),
                temperature=config.get('eval_temperature', 0.7),
            )
            results['eval'] = {
                'prompts': test_prompts,
                'responses': responses,
            }
            for p, r in zip(test_prompts, responses):
                logger.info(f"  [{p}] -> {r[:100]}...")

    # Save full pipeline results
    pipeline_results_path = Path(
        config.get('eval_output_dir', 'experiments/eval')
    ) / 'pipeline_results.json'
    pipeline_results_path.parent.mkdir(parents=True, exist_ok=True)
    with open(pipeline_results_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    logger.info(f"Pipeline results saved to {pipeline_results_path}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description='Run the full vixynt pipeline: prepare -> train -> evaluate'
    )
    parser.add_argument(
        '--config', type=str, required=True,
        help='Path to pipeline YAML config file',
    )
    parser.add_argument(
        '--skip-prepare', action='store_true',
        help='Skip the dataset preparation stage',
    )
    parser.add_argument(
        '--skip-train', action='store_true',
        help='Skip the training stage',
    )
    parser.add_argument(
        '--skip-eval', action='store_true',
        help='Skip the evaluation stage',
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )

    config = load_config(args.config)

    if args.skip_prepare:
        config['skip_prepare'] = True
    if args.skip_train:
        config['skip_train'] = True
    if args.skip_eval:
        config['skip_eval'] = True

    results = run_pipeline(config)

    print("\n=== Pipeline Complete ===")
    if 'manifest_path' in results:
        print(f"  Manifest:  {results['manifest_path']}")
    if 'model_path' in results:
        print(f"  Model:     {results['model_path']}")
    if 'eval' in results:
        eval_data = results['eval']
        if 'metrics' in eval_data:
            print(f"  Similarity: {eval_data['metrics']['mean_similarity']:.4f}")
        elif 'responses' in eval_data:
            print(f"  Responses:  {len(eval_data['responses'])} generated")


if __name__ == '__main__':
    main()
