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
                name="synthetic_pose_ms01",
                parameters=[
                    str(config),
                    {
                        "pose_topic": "/drone/ms01/private_pose",
                        "drone_id": "MS-01",
                        "publish_hz": 15.0,
                        "travel_seconds": 8.0,
                    },
                ],
            ),
            Node(
                package="midnight_checkpoint",
                executable="checkpoint_monitor",
                name="checkpoint_monitor_ms01",
                parameters=[
                    str(config),
                    {
                        "pose_topic": "/drone/ms01/private_pose",
                        "evidence_topic": "/midnight/ms01/private_checkpoint_evidence",
                    },
                ],
            ),
            Node(
                package="midnight_checkpoint",
                executable="bridge_forwarder",
                name="bridge_forwarder_ms01",
                parameters=[
                    str(config),
                    {
                        "drone_id": "MS-01",
                        "evidence_topic": "/midnight/ms01/private_checkpoint_evidence",
                        "result_topic": "/midnight/ms01/checkpoint_result",
                    },
                ],
            ),
            Node(
                package="midnight_checkpoint",
                executable="trajectory_visualizer",
                name="trajectory_visualizer_ms01",
                parameters=[
                    str(config),
                    {
                        "pose_topic": "/drone/ms01/private_pose",
                        "result_topic": "/midnight/ms01/checkpoint_result",
                        "drone_label": "MS-01",
                        "drone_color": "red",
                        "output_stem": "ms-01-checkpoint",
                        "animation_fps": 15,
                        "snapshot_stride": 3,
                    },
                ],
            ),
            Node(
                package="midnight_checkpoint",
                executable="mission_coordinator",
                name="mission_coordinator",
                parameters=[str(config)],
            ),
            Node(
                package="midnight_checkpoint",
                executable="synthetic_pose",
                name="synthetic_pose_ms02",
                parameters=[
                    str(config),
                    {
                        "pose_topic": "/drone/ms02/private_pose",
                        "start_topic": "/drone/ms02/start",
                        "drone_id": "MS-02",
                        "start_x": 5.0,
                        "start_y": 5.0,
                        "start_z": 0.0,
                        "target_x": 30.0,
                        "target_y": 35.0,
                        "target_z": 12.0,
                        "publish_hz": 15.0,
                        "travel_seconds": 8.0,
                    },
                ],
            ),
            Node(
                package="midnight_checkpoint",
                executable="checkpoint_monitor",
                name="checkpoint_monitor_ms02",
                parameters=[
                    str(config),
                    {
                        "pose_topic": "/drone/ms02/private_pose",
                        "evidence_topic": "/midnight/ms02/private_checkpoint_evidence",
                        "min_x": 20,
                        "max_x": 40,
                        "min_y": 25,
                        "max_y": 45,
                    },
                ],
            ),
            Node(
                package="midnight_checkpoint",
                executable="bridge_forwarder",
                name="bridge_forwarder_ms02",
                parameters=[
                    str(config),
                    {
                        "drone_id": "MS-02",
                        "evidence_topic": "/midnight/ms02/private_checkpoint_evidence",
                        "result_topic": "/midnight/ms02/checkpoint_result",
                    },
                ],
            ),
            Node(
                package="midnight_checkpoint",
                executable="trajectory_visualizer",
                name="trajectory_visualizer_ms02",
                parameters=[
                    str(config),
                    {
                        "pose_topic": "/drone/ms02/private_pose",
                        "result_topic": "/midnight/ms02/checkpoint_result",
                        "target_x": 30.0,
                        "target_y": 35.0,
                        "target_z": 12.0,
                        "drone_label": "MS-02",
                        "drone_color": "dodgerblue",
                        "output_stem": "ms-02-checkpoint",
                        "animation_fps": 15,
                        "snapshot_stride": 3,
                    },
                ],
            ),
        ]
    )
