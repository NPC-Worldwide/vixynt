"""Utility functions for vixynt."""

import numpy as np
from pathlib import Path
from typing import Union, List


def create_directories(paths: Union[str, List[str]]) -> None:
    """Create directories if they don't exist.
    
    Args:
        paths: Single path or list of paths to create
    """
    if isinstance(paths, str):
        paths = [paths]
    
    for path in paths:
        Path(path).mkdir(parents=True, exist_ok=True)


def ensure_data_dirs() -> None:
    """Ensure all required data directories exist."""
    dirs = ['data', 'figures', 'experiments']
    create_directories(dirs)
