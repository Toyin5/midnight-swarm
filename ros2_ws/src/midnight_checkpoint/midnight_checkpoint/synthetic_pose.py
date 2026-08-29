import numpy as np
import rclpy
from geometry_msgs.msg import PoseStamped
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import Bool


class SyntheticPosePublisher(Node):
    """Publishes a deterministic flight path; no physical drone is required."""

    def __init__(self) -> None:
        super().__init__("synthetic_pose_publisher")
        self.declare_parameter("pose_topic", "/drone/private_pose")
        self.declare_parameter("publish_hz", 5.0)
        self.declare_parameter("start_x", 0.0)
        self.declare_parameter("start_y", 0.0)
        self.declare_parameter("start_z", 0.0)
        self.declare_parameter("target_x", 52.0)
        self.declare_parameter("target_y", 81.0)
        self.declare_parameter("target_z", 20.0)
        self.declare_parameter("travel_seconds", 8.0)
        self.declare_parameter("start_topic", "")
        self.declare_parameter("drone_id", "MS-01")

        topic = self.get_parameter("pose_topic").value
        publish_hz = float(self.get_parameter("publish_hz").value)
        if publish_hz <= 0:
            raise ValueError("publish_hz must be positive")

        self._publisher = self.create_publisher(PoseStamped, topic, 10)
        self._period = 1.0 / publish_hz
        travel_seconds = max(float(self.get_parameter("travel_seconds").value), self._period)
        sample_count = max(2, round(travel_seconds * publish_hz) + 1)
        start = np.array(
            [
                self.get_parameter("start_x").value,
                self.get_parameter("start_y").value,
                self.get_parameter("start_z").value,
            ],
            dtype=float,
        )
        target = np.array(
            [
                self.get_parameter("target_x").value,
                self.get_parameter("target_y").value,
                self.get_parameter("target_z").value,
            ],
            dtype=float,
        )
        # Each column is stepped from the origin to the target at a constant rate.
        self._trajectory = np.linspace(start, target, num=sample_count)
        self._sample_index = 0
        self._timer = None
        start_topic = str(self.get_parameter("start_topic").value)
        if start_topic:
            start_qos = QoSProfile(
                depth=1,
                durability=DurabilityPolicy.TRANSIENT_LOCAL,
                reliability=ReliabilityPolicy.RELIABLE,
            )
            self._start_subscription = self.create_subscription(
                Bool, start_topic, self._on_start, start_qos
            )
            self.get_logger().info(
                f"{self.get_parameter('drone_id').value} waiting for finalized chain handoff"
            )
        else:
            self._start()

    def _on_start(self, message: Bool) -> None:
        if message.data:
            self._start()

    def _start(self) -> None:
        if self._timer is not None:
            return
        self._timer = self.create_timer(self._period, self._publish_pose)
        self.get_logger().info(
            f"{self.get_parameter('drone_id').value} synthetic private pose stream started"
        )

    def _publish_pose(self) -> None:
        position = self._trajectory[self._sample_index]
        message = PoseStamped()
        message.header.stamp = self.get_clock().now().to_msg()
        message.header.frame_id = "mission_local"
        message.pose.position.x = float(position[0])
        message.pose.position.y = float(position[1])
        message.pose.position.z = float(position[2])
        message.pose.orientation.w = 1.0
        self._publisher.publish(message)
        self._sample_index = min(self._sample_index + 1, len(self._trajectory) - 1)


def main(args=None) -> None:
    rclpy.init(args=args)
    node = SyntheticPosePublisher()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
