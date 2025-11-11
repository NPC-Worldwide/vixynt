"""
ResNet-based artifact generation for intelligent image augmentation.

This module uses pre-trained ResNet feature representations to generate
contextually-aware artifacts and variations that help the diffusion model
generalize better during fine-tuning.
"""

import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
import numpy as np
from PIL import Image
from pathlib import Path
from typing import List, Tuple, Optional, Union
import random


class ResNetFeatureExtractor:
    """Extract deep features from images using ResNet backbone."""
    
    def __init__(self, layer: str = 'layer4', device: str = 'cpu', pretrained: bool = True):
        """
        Initialize ResNet feature extractor.
        
        Args:
            layer: ResNet layer to extract features from
                  Options: 'layer1', 'layer2', 'layer3', 'layer4'
            device: 'cpu' or 'cuda'
            pretrained: Use pretrained ImageNet weights
        """
        self.device = device
        self.layer = layer
        
        # Load pretrained ResNet50
        self.resnet = models.resnet50(pretrained=pretrained)
        self.resnet = self.resnet.to(device)
        self.resnet.eval()
        
        # Create feature extractor hook
        self.features = None
        self._register_hook()
        
        # Normalization
        self.normalize = transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    
    def _register_hook(self):
        """Register forward hook to extract features."""
        layer_module = getattr(self.resnet, self.layer)
        
        def hook_fn(module, input, output):
            self.features = output.detach()
        
        layer_module.register_forward_hook(hook_fn)
    
    def extract(self, image: Union[Image.Image, np.ndarray]) -> torch.Tensor:
        """
        Extract features from image.
        
        Args:
            image: PIL Image or numpy array (0-255 or 0-1 range)
            
        Returns:
            Feature tensor of shape (1, C, H, W)
        """
        if isinstance(image, np.ndarray):
            # Handle both 0-255 and 0-1 ranges
            if image.max() <= 1.0:
                image = (image * 255).astype(np.uint8)
            image = Image.fromarray(image.astype(np.uint8))
        
        # Prepare image
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        image_tensor = transforms.ToTensor()(image)
        image_tensor = self.normalize(image_tensor).unsqueeze(0)
        image_tensor = image_tensor.to(self.device)
        
        # Extract features
        with torch.no_grad():
            _ = self.resnet(image_tensor)
            features = self.features
        
        return features


class ResNetAugmentor:
    """Generate feature-aware augmentations using ResNet representations."""
    
    def __init__(
        self,
        num_variations: int = 5,
        resnet_layer: str = 'layer4',
        device: str = 'cpu',
        feature_perturbation_strength: float = 0.1,
        seed: Optional[int] = None
    ):
        """
        Initialize ResNet-based augmentor.
        
        Args:
            num_variations: Number of variations per image
            resnet_layer: ResNet layer for feature extraction
            device: Device to use ('cpu' or 'cuda')
            feature_perturbation_strength: Strength of feature space perturbation
            seed: Random seed for reproducibility
        """
        self.num_variations = num_variations
        self.device = device
        self.feature_perturbation_strength = feature_perturbation_strength
        
        self.feature_extractor = ResNetFeatureExtractor(
            layer=resnet_layer,
            device=device,
            pretrained=True
        )
        
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
            torch.manual_seed(seed)
    
    def perturb_in_feature_space(
        self,
        features: torch.Tensor,
        perturbation_type: str = 'gaussian'
    ) -> torch.Tensor:
        """
        Perturb features to create variations.
        
        Args:
            features: Feature tensor from ResNet
            perturbation_type: 'gaussian', 'uniform', or 'structured'
            
        Returns:
            Perturbed feature tensor
        """
        perturbed = features.clone()
        
        if perturbation_type == 'gaussian':
            noise = torch.randn_like(features) * self.feature_perturbation_strength
            perturbed = features + noise
            
        elif perturbation_type == 'uniform':
            noise = (torch.rand_like(features) - 0.5) * 2 * self.feature_perturbation_strength
            perturbed = features + noise
            
        elif perturbation_type == 'structured':
            # Channel-wise scaling for more structured perturbation
            channel_scales = 1.0 + (torch.randn(features.shape[0], features.shape[1], 1, 1) 
                                   * self.feature_perturbation_strength)
            channel_scales = channel_scales.to(self.device)
            perturbed = features * channel_scales
        
        return perturbed
    
    def spatial_attention_mask(
        self,
        features: torch.Tensor,
        num_regions: int = 4,
        dropout_prob: float = 0.3
    ) -> torch.Tensor:
        """
        Create spatial attention masks by dropping random regions.
        
        Args:
            features: Feature tensor
            num_regions: Number of spatial regions to drop
            dropout_prob: Probability of dropping each region
            
        Returns:
            Masked feature tensor
        """
        masked_features = features.clone()
        
        batch_size, channels, height, width = features.shape
        
        for _ in range(num_regions):
            # Random region
            h_start = random.randint(0, max(0, height - height // 4))
            w_start = random.randint(0, max(0, width - width // 4))
            h_size = random.randint(height // 8, height // 4)
            w_size = random.randint(width // 8, width // 4)
            
            h_end = min(h_start + h_size, height)
            w_end = min(w_start + w_size, width)
            
            # Apply dropout
            if random.random() < dropout_prob:
                masked_features[:, :, h_start:h_end, w_start:w_end] *= 0.5
        
        return masked_features
    
    def frequency_aware_augmentation(
        self,
        image: Union[Image.Image, np.ndarray],
        augmentation_strength: float = 0.15
    ) -> np.ndarray:
        """
        Apply frequency-aware augmentation in image space.
        
        This applies different augmentations to different frequency components
        to preserve semantic content while adding controlled noise.
        
        Args:
            image: Input image
            augmentation_strength: Strength of augmentation
            
        Returns:
            Augmented image as numpy array
        """
        if isinstance(image, Image.Image):
            image_np = np.array(image) / 255.0
        else:
            image_np = image.copy()
        
        # Convert to frequency domain
        if image_np.ndim == 3:
            # Handle RGB images
            augmented = np.zeros_like(image_np)
            for c in range(3):
                channel = image_np[:, :, c]
                freq = np.fft.fft2(channel)
                
                # Add noise to high frequencies
                mag = np.abs(freq)
                phase = np.angle(freq)
                
                # Create frequency mask (amplify high frequencies slightly)
                h, w = mag.shape
                freq_mask = np.sqrt(
                    np.fft.fftfreq(h)[:, np.newaxis]**2 + 
                    np.fft.fftfreq(w)[np.newaxis, :]**2
                )
                freq_mask = np.clip(freq_mask / freq_mask.max() * 2, 0, 1)
                
                # Apply augmentation
                noise_level = np.max(mag) * augmentation_strength * freq_mask
                noise = np.random.normal(0, noise_level)
                mag_aug = mag + noise
                
                freq_aug = mag_aug * np.exp(1j * phase)
                augmented[:, :, c] = np.real(np.fft.ifft2(freq_aug))
        else:
            # Grayscale
            freq = np.fft.fft2(image_np)
            mag = np.abs(freq)
            phase = np.angle(freq)
            
            h, w = mag.shape
            freq_mask = np.sqrt(
                np.fft.fftfreq(h)[:, np.newaxis]**2 + 
                np.fft.fftfreq(w)[np.newaxis, :]**2
            )
            freq_mask = np.clip(freq_mask / freq_mask.max() * 2, 0, 1)
            
            noise_level = np.max(mag) * augmentation_strength * freq_mask
            noise = np.random.normal(0, noise_level)
            mag_aug = mag + noise
            
            freq_aug = mag_aug * np.exp(1j * phase)
            augmented = np.real(np.fft.ifft2(freq_aug))
        
        return np.clip(augmented, 0, 1)
    
    def generate_variations(
        self,
        image_path: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
        save_images: bool = True
    ) -> List[np.ndarray]:
        """
        Generate feature-aware variations of an image.
        
        Args:
            image_path: Path to input image
            output_dir: Directory to save augmented images
            save_images: Whether to save images
            
        Returns:
            List of augmented images
        """
        image = Image.open(image_path).convert('RGB')
        image_np = np.array(image) / 255.0
        
        # Extract features
        features = self.feature_extractor.extract(image_np)
        
        variations = []
        augmentation_types = ['gaussian', 'uniform', 'structured', 'frequency']
        
        for i in range(self.num_variations):
            # Choose augmentation type
            aug_type = random.choice(augmentation_types)
            
            if aug_type == 'frequency':
                # Frequency-aware augmentation in image space
                aug_image_np = self.frequency_aware_augmentation(
                    image_np,
                    augmentation_strength=random.uniform(0.1, 0.2)
                )
            else:
                # Feature space perturbation
                perturbed_features = self.perturb_in_feature_space(features, aug_type)
                
                # Add spatial attention masking
                if random.random() > 0.5:
                    perturbed_features = self.spatial_attention_mask(perturbed_features)
                
                # For now, convert back to image space with frequency augmentation
                aug_image_np = self.frequency_aware_augmentation(image_np)
            
            variations.append(aug_image_np)
            
            # Save if requested
            if save_images and output_dir is not None:
                output_path = Path(output_dir)
                output_path.mkdir(parents=True, exist_ok=True)
                
                stem = Path(image_path).stem
                suffix = Path(image_path).suffix
                save_path = output_path / f"{stem}_resnet_aug_{i}{suffix}"
                
                Image.fromarray((aug_image_np * 255).astype(np.uint8)).save(save_path)
        
        return variations
    
    def batch_augment_with_features(
        self,
        input_dir: Union[str, Path],
        output_dir: Union[str, Path],
        feature_output_dir: Optional[Union[str, Path]] = None,
        extensions: List[str] = ['jpg', 'jpeg', 'png']
    ) -> dict:
        """
        Batch augment images and optionally save feature statistics.
        
        Args:
            input_dir: Input image directory
            output_dir: Directory to save augmented images
            feature_output_dir: Optional directory to save feature statistics
            extensions: File extensions to process
            
        Returns:
            Statistics dictionary
        """
        input_path = Path(input_dir)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        stats = {
            'total_images': 0,
            'total_variations': 0,
            'successful': 0,
            'failed': []
        }
        
        for ext in extensions:
            for image_file in input_path.glob(f'*.{ext}'):
                try:
                    variations = self.generate_variations(
                        image_file,
                        output_dir=output_path,
                        save_images=True
                    )
                    stats['total_images'] += 1
                    stats['total_variations'] += len(variations)
                    stats['successful'] += 1
                except Exception as e:
                    stats['failed'].append((str(image_file), str(e)))
        
        return stats
