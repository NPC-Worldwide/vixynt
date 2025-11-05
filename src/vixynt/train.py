"""Training script for diffusion fine-tuning experiments."""

import argparse
from pathlib import Path
from vixynt.config import load_config


def main():
    parser = argparse.ArgumentParser(description='Train diffusion model')
    parser.add_argument('--config', type=str, required=True, help='Path to config file')
    parser.add_argument('--output-dir', type=str, default='experiments', help='Output directory')
    args = parser.parse_args()
    
    # Load configuration
    config = load_config(args.config)
    
    print(f"Training with config: {args.config}")
    print(f"Config: {config}")
    
    # TODO: Implement training loop using npcpy.ft.diff
    

if __name__ == '__main__':
    main()
