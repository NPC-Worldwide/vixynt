# vixynt

Diffusion fine-tuning experiments using the `npcpy.ft.diff` module with intelligent data augmentation.

## Overview

This repository contains experimental code and configurations for fine-tuning diffusion models using the `npcpy.ft.diff` module from the [npcpy](https://github.com/NPC-Worldwide/npcpy) toolkit. The project focuses on enabling users to create custom diffusion models from their own image datasets with intelligent augmentation and noise/artifact injection for improved generalization.

### Key Features

- **N-Variation Generation**: Generate multiple augmented variations of input images to expand training datasets
- **Intelligent Artifact Injection**: Apply contextually-aware noise and artifacts using ResNet feature representations
- **Flexible Augmentation**: Multiple augmentation strategies (Gaussian noise, JPEG compression, blur, color jitter, etc.)
- **Vision Model Integration**: Caption generation for augmented images using vision models (CLIP support)
- **Batch Processing**: Efficient batch augmentation of entire image directories

## Project Structure

```
vixynt/
├── README.md                         # This file
├── requirements.txt                  # Python dependencies
├── setup.py                          # Package setup
├── data/                             # Training and evaluation data
├── figures/                          # Generated plots and visualizations
├── experiments/                      # Experiment configurations and results
├── src/
│   └── vixynt/                      # Main package
│       ├── __init__.py
│       ├── config.py                # Configuration management
│       ├── train.py                 # Training scripts
│       ├── utils.py                 # Utility functions
│       ├── evaluate.py              # Evaluation scripts
│       ├── data_augmentation.py     # N-variation generation and noise injection
│       └── resnet_augmentation.py   # ResNet-based feature-aware augmentation
└── notebooks/                        # Jupyter notebooks for exploration
```

## Requirements

- Python 3.8+
- PyTorch 1.9+
- Torchvision 0.10+
- [npcpy](https://github.com/NPC-Worldwide/npcpy)
- Transformers (for vision models)
- See `requirements.txt` for full dependencies

## Installation

```bash
git clone https://github.com/NPC-Worldwide/vixynt.git
cd vixynt
pip install -r requirements.txt
pip install -e .
```

## Core Modules

### 1. Data Augmentation (`data_augmentation.py`)

The `ImageAugmentor` class generates N variations of input images with configurable artifact injection strategies.

#### Features:

- **Gaussian Noise**: Add controllable Gaussian noise for robustness
- **JPEG Compression**: Simulate real-world compression artifacts
- **Gaussian Blur**: Create blurred variations for scale invariance
- **Color Jitter**: Random brightness, contrast, and saturation variations
- **Individual Controls**: Adjust each artifact independently

#### Usage:

```python
from vixynt.data_augmentation import ImageAugmentor

# Initialize augmentor
augmentor = ImageAugmentor(
    num_variations=5,
    noise_level=0.1,
    jpeg_quality_range=(60, 95),
    blur_sigma_range=(0.5, 2.0),
    artifact_types=['gaussian_noise', 'jpeg_compression', 'blur', 'color_jitter']
)

# Generate variations for single image
variations = augmentor.generate_variations(
    'path/to/image.jpg',
    output_dir='data/augmented',
    save_images=True
)

# Batch augmentation
stats = augmentor.batch_augment(
    input_dir='data/raw',
    output_dir='data/augmented'
)

print(f"Generated {stats['total_variations']} total variations from {stats['total_images']} images")
```

### Caption Generation

The `CaptionGenerator` class creates descriptive captions for augmented images using vision models:

```python
from vixynt.data_augmentation import CaptionGenerator

caption_gen = CaptionGenerator(model_name='clip')

# Generate captions for variations
captions = caption_gen.generate_captions_for_variations(
    variations,
    num_captions_per_image=3
)

for var_idx, caption_list in enumerate(captions):
    print(f"Variation {var_idx}: {caption_list}")
```

### 2. ResNet-Based Augmentation (`resnet_augmentation.py`)

The `ResNetAugmentor` class provides intelligent, feature-aware augmentation using pre-trained ResNet50 feature representations. This approach preserves semantic content while adding controlled variations.

#### Advanced Features:

- **Feature Space Perturbation**: Gaussian, uniform, or structured perturbations in ResNet feature space
- **Spatial Attention Masking**: Randomly mask spatial regions to create diverse variations
- **Frequency-Aware Augmentation**: FFT-based augmentation that preserves semantic content in low frequencies while adding controlled noise to high frequencies
- **Layer-Specific Features**: Extract and perturb features from specific ResNet layers

#### Usage:

```python
from vixynt.resnet_augmentation import ResNetAugmentor

# Initialize ResNet augmentor
resnet_augmentor = ResNetAugmentor(
    num_variations=5,
    resnet_layer='layer4',      # Deep features for semantic content
    device='cuda' if torch.cuda.is_available() else 'cpu',
    feature_perturbation_strength=0.1
)

# Generate feature-aware variations
variations = resnet_augmentor.generate_variations(
    'path/to/image.jpg',
    output_dir='data/resnet_augmented',
    save_images=True
)

# Batch processing with feature statistics
stats = resnet_augmentor.batch_augment_with_features(
    input_dir='data/raw',
    output_dir='data/resnet_augmented',
    feature_output_dir='data/features'
)
```

#### Augmentation Strategies:

1. **Gaussian Perturbation**: `N(features, σ)` - Adds Gaussian noise in feature space
2. **Uniform Perturbation**: Adds uniform noise in feature space
3. **Structured Perturbation**: Channel-wise scaling for more realistic variations
4. **Frequency-Aware**: FFT-based augmentation in image space

## Usage Example

Complete workflow for creating a custom diffusion model:

```python
from vixynt.data_augmentation import ImageAugmentor, CaptionGenerator
from vixynt.resnet_augmentation import ResNetAugmentor
from npcpy.ft.diff import DiffusionFineTuner
from vixynt.config import load_config

# Step 1: Generate augmented variations
augmentor = ImageAugmentor(num_variations=5)
stats = augmentor.batch_augment(
    input_dir='data/raw_photos',
    output_dir='data/augmented'
)
print(f"Generated {stats['total_variations']} variations")

# Step 2: Generate captions for training data
caption_gen = CaptionGenerator(model_name='clip')
# Process images and generate captions...

# Step 3: Fine-tune diffusion model
config = load_config('experiments/config.yaml')
fine_tuner = DiffusionFineTuner(config)

# Point to augmented dataset
fine_tuner.train(data_path='data/augmented')

# Step 4: Evaluate
results = fine_tuner.evaluate()
print(f"Model performance: {results}")

# Step 5: Generate samples
samples = fine_tuner.generate_samples(num_samples=10)
for i, sample in enumerate(samples):
    sample.save(f'figures/sample_{i}.png')
```

## Use Cases

### 1. Personal Editing Style Transfer
- Collect photos from your personal archive
- Train a model on your edited versions with augmentation
- Use the fine-tuned model to automatically apply your editing style to new photos

### 2. Location-Specific Models
- Gather photos from a specific location (Grand Canyon, etc.)
- Create augmented training dataset
- Fine-tune a model that generates images in that specific aesthetic

### 3. Subject-Specific Models
- Collect images of specific objects or scenes
- Augment the dataset for diversity
- Train a specialized model for that domain

### 4. Artistic Style Capture
- Combine style variations (e.g., hand-drawn, watercolor, oil painting)
- Use augmentation to expand limited training data
- Create a model that learns to apply that style

## Configuration

Create experiment configurations in `experiments/` directory:

```yaml
# experiments/my_style_transfer.yaml
model:
  name: "stable-diffusion-v1-5"
  device: "cuda"
  
training:
  num_epochs: 100
  batch_size: 4
  learning_rate: 1e-4
  
augmentation:
  num_variations: 5
  noise_level: 0.1
  artifact_types: ["gaussian_noise", "jpeg_compression", "blur"]
  
data:
  training_split: 0.8
  validation_split: 0.1
  test_split: 0.1
```

## Quick Start

1. **Prepare raw images**: Place your images in `data/raw_photos/`

2. **Generate augmented dataset**:
```bash
python -c "
from vixynt.data_augmentation import ImageAugmentor
aug = ImageAugmentor(num_variations=5)
aug.batch_augment('data/raw_photos', 'data/augmented')
"
```

3. **Configure your experiment**: Edit or create `experiments/my_experiment.yaml`

4. **Train**:
```bash
python src/vixynt/train.py --config experiments/my_experiment.yaml
```

5. **Generate samples**: Check `figures/` directory for results

6. **Evaluate model performance**:
```bash
python src/vixynt/evaluate.py --model-path models/my_model.pth
```

## Advanced Features

### Custom Artifact Combinations

```python
augmentor = ImageAugmentor(
    num_variations=10,
    artifact_types=['gaussian_noise', 'color_jitter', 'blur'],
    seed=42  # For reproducibility
)
```

### ResNet Layer Selection

Use different ResNet layers for different augmentation strategies:

- `layer1`: Early features (edges, textures)
- `layer2`: Mid-level features (shapes)
- `layer3`: High-level features (objects)
- `layer4`: Semantic features (scene understanding)

```python
augmentor = ResNetAugmentor(resnet_layer='layer3')  # Object-level features
```

### Frequency-Aware Augmentation

Preserves semantic content by operating primarily on high frequencies:

```python
aug_image = augmentor.frequency_aware_augmentation(
    image,
    augmentation_strength=0.15
)
```

## Experiments

Results and configurations from various experiments are stored in the `experiments/` directory.

### Test Datasets

- Personal photo collection (varies by user)
- Grand Canyon imagery (landscape aesthetics)
- Kanji/calligraphy datasets (artistic style)

## Contributing

Contributions are welcome! Areas of interest:

- Additional augmentation strategies
- More vision models for caption generation
- Diffusion model architecture improvements
- Evaluation metrics and visualizations
- Documentation and examples

## References

- [Hugging Face Diffusers](https://github.com/huggingface/diffusers)
- [Stable Diffusion Fine-tuning](https://huggingface.co/docs/diffusers/training/text2image)
- [ResNet Feature Extraction](https://pytorch.org/vision/main/models/resnet.html)
- [npcpy.ft.diff Module](https://github.com/NPC-Worldwide/npcpy/blob/main/npcpy/ft/diff.py)

## License

See LICENSE for details.
