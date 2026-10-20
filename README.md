# Pixels-to-Phase

**Reliability-Aware Latent State-Space Modeling for Contactless Respiratory Estimation**

Shadman Sakib, Nirmalya Roy
University of Maryland, Baltimore County

*WACV 2027 (Main Track)*

[Project Page](https://sakibshadman.github.io/pixels-to-phase/)

## Overview

Pixels-to-Phase models breathing as a latent phase on the unit circle. At each frame, the phase is predicted from learned dynamics and then corrected by the video, weighted by an estimated observation reliability. Across RGB, NIR and thermal benchmarks, it reduces average respiratory-rate MAE from 1.69 to 1.51 breaths per minute.

Code and dataset release information will be posted on the project page.

## Citation

```bibtex
@inproceedings{sakib2027pixels,
  title     = {Pixels-to-Phase: Reliability-Aware Latent State-Space
               Modeling for Contactless Respiratory Estimation},
  author    = {Sakib, Shadman and Roy, Nirmalya},
  booktitle = {Proceedings of the IEEE/CVF Winter Conference on
               Applications of Computer Vision (WACV)},
  year      = {2027}
}
```

## License

This website is licensed under a [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).
