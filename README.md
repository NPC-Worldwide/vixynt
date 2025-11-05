# vixynt

Diffusion fine-tuning experiments using the `npcpy.ft.diff` module.

## Overview

This repository contains experimental code and configurations for fine-tuning diffusion models using the `npcpy.ft.diff` module from the [npcpy](https://github.com/NPC-Worldwide/npcpy) toolkit.

## Project Structure

```
vixynt/
├── README.md                 # This file
├── requirements.txt          # Python dependencies
├── setup.py                  # Package setup
├── data/                     # Training and evaluation data
├── figures/                  # Generated plots and visualizations
├── experiments/              # Experiment configurations and results
├── src/
│   └── vixynt/              # Main package
│       ├── __init__.py
│       ├── config.py        # Configuration management
│       ├── train.py         # Training scripts
│       ├── utils.py         # Utility functions
│       └── evaluate.py      # Evaluation scripts
└── notebooks/               # Jupyter notebooks for exploration
```

## Requirements

- Python 3.8+
- PyTorch
- [npcpy](https://github.com/NPC-Worldwide/npcpy)
- See `requirements.txt` for full dependencies

## Installation

```bash
git clone https://github.com/NPC-Worldwide/vixynt.git
cd vixynt
pip install -r requirements.txt
pip install -e .
```

## Usage

Basic usage example:

```python
from npcpy.ft.diff import DiffusionFineTuner
from vixynt.config import load_config

# Load configuration
config = load_config('experiments/config.yaml')

# Initialize fine-tuner
fine_tuner = DiffusionFineTuner(config)

# Train
fine_tuner.train()

# Evaluate
results = fine_tuner.evaluate()
```

## Quick Start

1. Prepare your data in the `data/` directory
2. Configure your experiment in `experiments/`
3. Run training: `python src/vixynt/train.py --config experiments/config.yaml`
4. Check results in `figures/` for visualizations

## Experiments

Experiment configurations and results are stored in the `experiments/` directory.

## Contributing

Contributions are welcome! Please ensure code follows project conventions and includes appropriate documentation.

## License

See LICENSE for details.
