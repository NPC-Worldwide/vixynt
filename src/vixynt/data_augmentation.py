"""
Data augmentation module for generating multiple variations of input images
with noise and artifacts to improve generalization during diffusion model training.
"""

import numpy as np
import torch
import torchvision.transforms as transforms
from PIL import Image, ImageFilter, ImageOps, ImageEnhance
from pathlib import Path
from typing import List, Tuple, Optional, Union
import random


class ImageAugmentor:
    """Generate N augmented variations of an image for dataset diversification."""
    
    def __init__(
        self,
        num_variations: int = 5,
        noise_level: float = 0.1,
        jpeg_quality_range: Tuple[int, int] = (60, 95),
        blur_sigma_range: Tuple[float, float] = (0.5, 2.0),
        artifact_types: Optional[List[str]] = None,
        seed: Optional[int] = None
    ):
        """
        Initialize the augmentor.
        
        Args:
            num_variations: Number of variations to generate per image
            noise_level: Standard deviation of Gaussian noise (0-1)
            jpeg_quality_range: Range of JPEG quality compression
            blur_sigma_range: Range of Gaussian blur sigma
            artifact_types: List of artifact types to apply
                          Options: ['gaussian_noise', 'jpeg_compression', 'blur', 
                                   'color_jitter', 'brightness', 'contrast']
            seed: Random seed for reproducibility
        """
        self.num_variations = num_variations
        self.noise_level = noise_level
        self.jpeg_quality_range = jpeg_quality_range
        self.blur_sigma_range = blur_sigma_range
        self.seed = seed
        
        if artifact_types is None:
            artifact_types = [
                'gaussian_noise', 'jpeg_compression', 'blur', 
                'color_jitter', 'brightness'
            ]
        self.artifact_types = artifact_types
        
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
            torch.manual_seed(seed)
    
    def add_gaussian_noise(self, image: np.ndarray, intensity: float) -> np.ndarray:
        """Add Gaussian noise to image."""
        noise = np.random.normal(0, intensity, image.shape)
        noisy_image = np.clip(image + noise, 0, 1)
        return noisy_image
    
    def add_jpeg_compression(self, image_pil: Image.Image, quality: int) -> Image.Image:
        """Simulate JPEG compression artifacts."""
        import io
        buffer = io.BytesIO()
        image_pil.save(buffer, format='JPEG', quality=quality)
        buffer.seek(0)
        return Image.open(buffer).convert('RGB')
    
    def add_gaussian_blur(self, image_pil: Image.Image, sigma: float) -> Image.Image:
        """Add Gaussian blur."""
        return image_pil.filter(ImageFilter.GaussianBlur(radius=sigma))
    
    def add_color_jitter(self, image_pil: Image.Image) -> Image.Image:
        """Apply random color jitter."""
        brightness_factor = random.uniform(0.8, 1.2)
        contrast_factor = random.uniform(0.8, 1.2)
        saturation_factor = random.uniform(0.8, 1.2)
        
        image_pil = ImageEnhance.Brightness(image_pil).enhance(brightness_factor)
        image_pil = ImageEnhance.Contrast(image_pil).enhance(contrast_factor)
        image_pil = ImageEnhance.Color(image_pil).enhance(saturation_factor)
        
        return image_pil
    
    def add_brightness_variation(self, image_pil: Image.Image) -> Image.Image:
        """Add brightness variation."""
        factor = random.uniform(0.9, 1.1)
        return ImageEnhance.Brightness(image_pil).enhance(factor)
    
    def add_contrast_variation(self, image_pil: Image.Image) -> Image.Image:
        """Add contrast variation."""
        factor = random.uniform(0.9, 1.1)
        return ImageEnhance.Contrast(image_pil).enhance(factor)
    
    def generate_variations(
        self,
        image_path: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
        save_images: bool = True
    ) -> List[np.ndarray]:
        """
        Generate N variations of an image.
        
        Args:
            image_path: Path to input image
            output_dir: Directory to save augmented images (optional)
            save_images: Whether to save augmented images
            
        Returns:
            List of augmented image arrays (normalized to 0-1 range)
        """
        # Load image
        image = Image.open(image_path).convert('RGB')
        image_np = np.array(image) / 255.0
        
        variations = []
        
        for i in range(self.num_variations):
            aug_image = image.copy()
            
            # Apply random selection of artifacts
            num_artifacts = random.randint(1, len(self.artifact_types))
            selected_artifacts = random.sample(self.artifact_types, num_artifacts)
            
            for artifact in selected_artifacts:
                if artifact == 'gaussian_noise':
                    aug_image_np = np.array(aug_image) / 255.0
                    noise_intensity = random.uniform(0, self.noise_level)
                    aug_image_np = self.add_gaussian_noise(aug_image_np, noise_intensity)
                    aug_image = Image.fromarray((aug_image_np * 255).astype(np.uint8))
                    
                elif artifact == 'jpeg_compression':
                    quality = random.randint(*self.jpeg_quality_range)
                    aug_image = self.add_jpeg_compression(aug_image, quality)
                    
                elif artifact == 'blur':
                    sigma = random.uniform(*self.blur_sigma_range)
                    aug_image = self.add_gaussian_blur(aug_image, sigma)
                    
                elif artifact == 'color_jitter':
                    aug_image = self.add_color_jitter(aug_image)
                    
                elif artifact == 'brightness':
                    aug_image = self.add_brightness_variation(aug_image)
                    
                elif artifact == 'contrast':
                    aug_image = self.add_contrast_variation(aug_image)
            
            # Convert to numpy array (0-1 range)
            aug_image_np = np.array(aug_image) / 255.0
            variations.append(aug_image_np)
            
            # Save if requested
            if save_images and output_dir is not None:
                output_path = Path(output_dir)
                output_path.mkdir(parents=True, exist_ok=True)
                
                stem = Path(image_path).stem
                suffix = Path(image_path).suffix
                save_path = output_path / f"{stem}_aug_{i}{suffix}"
                
                Image.fromarray((aug_image_np * 255).astype(np.uint8)).save(save_path)
        
        return variations
    
    def batch_augment(
        self,
        input_dir: Union[str, Path],
        output_dir: Union[str, Path],
        extensions: List[str] = ['jpg', 'jpeg', 'png', 'webp']
    ) -> dict:
        """
        Augment all images in a directory.
        
        Args:
            input_dir: Directory containing input images
            output_dir: Directory to save augmented images
            extensions: File extensions to process
            
        Returns:
            Dictionary with statistics about augmentation
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


class CaptionGenerator:
    """Generate captions for augmented image variations using vision models."""
    
    def __init__(self, model_name: str = "clip"):
        """
        Initialize caption generator.
        
        Args:
            model_name: Name of vision model to use (currently supports 'clip')
        """
        self.model_name = model_name
        self.model = None
        self.processor = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the vision model."""
        try:
            if self.model_name == "clip":
                from transformers import CLIPProcessor, CLIPModel
                self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
                self.processor = CLIPProcessor.from_pretrained(
                    "openai/clip-vit-base-patch32"
                )
        except ImportError:
            raise ImportError(
                f"Model {self.model_name} requires additional dependencies. "
                "Install with: pip install transformers"
            )
    
    def generate_caption(self, image: Union[Image.Image, np.ndarray]) -> str:
        """
        Generate a caption for an image.
        
        Args:
            image: PIL Image or numpy array
            
        Returns:
            Caption string
        """
        if isinstance(image, np.ndarray):
            image = Image.fromarray((image * 255).astype(np.uint8))
        
        # For now, return placeholder
        # In production, integrate with actual vision model API
        return "A detailed description of the image generated by vision model"
    
    def generate_captions_for_variations(
        self,
        variations: List[np.ndarray],
        num_captions_per_image: int = 1
    ) -> List[List[str]]:
        """
        Generate multiple captions for image variations.
        
        Args:
            variations: List of augmented image variations
            num_captions_per_image: Number of captions per image
            
        Returns:
            List of caption lists
        """
        all_captions = []
        for image in variations:
            captions = []
            for _ in range(num_captions_per_image):
                caption = self.generate_caption(image)
                captions.append(caption)
            all_captions.append(captions)
        
        return all_captions
