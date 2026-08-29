import json
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import Bool

from .handoff import should_start_drone


class MissionCoordinator(Node):
    """Starts drone two only after finalized public state verifies drone one."""

    def __init__(self) -> None:
        super().__init__("mission_coordinator")
        self.declare_parameter("status_url", "http://midnight-bridge:3001/checkpoint-status/MS-01")
        self.declare_parameter("start_topic", "/drone/ms02/start")
        self.declare_parameter("poll_seconds", 1.0)
        self._started = False
        start_qos = QoSProfile(
            depth=1,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            reliability=ReliabilityPolicy.RELIABLE,
        )
        self._publisher = self.create_publisher(
            Bool, self.get_parameter("start_topic").value, start_qos
        )
        self._timer = self.create_timer(
            float(self.get_parameter("poll_seconds").value), self._poll_chain
        )
        self.get_logger().info("Mission coordinator waiting for finalized MS-01 ledger state")

    def _poll_chain(self) -> None:
        if self._started:
            return
        try:
            with urlopen(self.get_parameter("status_url").value, timeout=5.0) as response:
                status = json.loads(response.read().decode())
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            return
        if not should_start_drone(status):
            return
        self._started = True
        signal = Bool()
        signal.data = True
        self._publisher.publish(signal)
        self.get_logger().info("Finalized MS-01 state observed; MS-02 start published")


def main(args=None) -> None:
    rclpy.init(args=args)
    node = MissionCoordinator()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
