from glob import glob

from setuptools import find_packages, setup

package_name = "midnight_checkpoint"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=("test",)),
    data_files=[
        ("share/ament_index/resource_index/packages", [f"resource/{package_name}"]),
        (f"share/{package_name}", ["package.xml"]),
        (f"share/{package_name}/config", glob("config/*.yaml")),
        (f"share/{package_name}/launch", glob("launch/*.launch.py")),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="Midnight Swarm Team",
    maintainer_email="maintainer@example.com",
    description="Synthetic checkpoint evidence for the Midnight swarm demo.",
    license="Apache-2.0",
    entry_points={
        "console_scripts": [
            "bridge_forwarder = midnight_checkpoint.bridge_forwarder:main",
            "checkpoint_monitor = midnight_checkpoint.checkpoint_monitor:main",
            "mission_coordinator = midnight_checkpoint.mission_coordinator:main",
            "synthetic_pose = midnight_checkpoint.synthetic_pose:main",
            "trajectory_visualizer = midnight_checkpoint.trajectory_visualizer:main",
        ],
    },
)
