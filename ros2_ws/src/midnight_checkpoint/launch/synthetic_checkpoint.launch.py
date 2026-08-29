from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch_ros.actions import Node

from launch import LaunchDescription


def generate_launch_description() -> LaunchDescription:
    config = Path(get_package_share_directory("midnight_checkpoint")) / "config/checkpoint.yaml"
    return LaunchDescription(
        [
            Node(
                package="midnight_checkpoint",
                executable="synthetic_pose",
                name="synthetic_pose_publisher",
                parameters=[str(config)],
            ),
            Node(
                package="midnight_checkpoint",
                executable="checkpoint_monitor",
                name="checkpoint_monitor",
                parameters=[str(config)],
            ),
            Node(
                package="midnight_checkpoint",
                executable="bridge_forwarder",
                name="midnight_bridge_forwarder",
                parameters=[str(config)],
            ),
            Node(
                package="midnight_checkpoint",
                executable="trajectory_visualizer",
                name="trajectory_visualizer",
                parameters=[str(config)],
            ),
        ]
    )
