import rclpy
from geometry_msgs.msg import PoseStamped
from rclpy.node import Node
from std_msgs.msg import UInt32MultiArray

from .geometry import Bounds, ConsecutiveHitDetector, fixed_point


class CheckpointMonitor(Node):
    """Turns a stable local pose observation into one Compact-compatible input."""

    def __init__(self) -> None:
        super().__init__("checkpoint_monitor")
        self.declare_parameter("pose_topic", "/drone/private_pose")
        self.declare_parameter("evidence_topic", "/midnight/private_checkpoint_evidence")
        self.declare_parameter("units_per_meter", 1)
        self.declare_parameter("required_samples", 3)
        self.declare_parameter("min_x", 40)
        self.declare_parameter("max_x", 60)
        self.declare_parameter("min_y", 70)
        self.declare_parameter("max_y", 90)

        self._units_per_meter = int(self.get_parameter("units_per_meter").value)
        bounds = Bounds(
            min_x=int(self.get_parameter("min_x").value),
            max_x=int(self.get_parameter("max_x").value),
            min_y=int(self.get_parameter("min_y").value),
            max_y=int(self.get_parameter("max_y").value),
        )
        self._detector = ConsecutiveHitDetector(
            bounds, int(self.get_parameter("required_samples").value)
        )
        self._evidence_publisher = self.create_publisher(
            UInt32MultiArray, self.get_parameter("evidence_topic").value, 1
        )
        self._subscription = self.create_subscription(
            PoseStamped, self.get_parameter("pose_topic").value, self._on_pose, 10
        )
        self.get_logger().info("Checkpoint monitor armed; private positions will not be logged")

    def _on_pose(self, message: PoseStamped) -> None:
        try:
            x = fixed_point(message.pose.position.x, self._units_per_meter)
            y = fixed_point(message.pose.position.y, self._units_per_meter)
        except ValueError as error:
            self.get_logger().warning(f"Rejected invalid private position: {error}")
            return

        if not self._detector.observe(x, y):
            return

        bounds = self._detector.bounds
        evidence = UInt32MultiArray()
        evidence.data = [x, y, bounds.min_x, bounds.max_x, bounds.min_y, bounds.max_y]
        self._evidence_publisher.publish(evidence)
        self.get_logger().info("Checkpoint evidence ready for the local Midnight bridge")


def main(args=None) -> None:
    rclpy.init(args=args)
    node = CheckpointMonitor()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
