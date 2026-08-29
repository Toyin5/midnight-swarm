import json
import time
from contextlib import suppress
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import rclpy
from rclpy.node import Node
from std_msgs.msg import String, UInt32MultiArray


class BridgeForwarder(Node):
    """Forwards one private ROS evidence message to the local Compact bridge."""

    def __init__(self) -> None:
        super().__init__("midnight_bridge_forwarder")
        self.declare_parameter("evidence_topic", "/midnight/private_checkpoint_evidence")
        self.declare_parameter("result_topic", "/midnight/checkpoint_result")
        self.declare_parameter("bridge_url", "http://midnight-bridge:3001/checkpoint")
        self.declare_parameter("timeout_seconds", 180.0)
        self.declare_parameter("max_attempts", 3)
        self._submitted = False
        self._result_publisher = self.create_publisher(
            String, self.get_parameter("result_topic").value, 1
        )
        self._subscription = self.create_subscription(
            UInt32MultiArray,
            self.get_parameter("evidence_topic").value,
            self._on_evidence,
            1,
        )
        self.get_logger().info("Local Midnight bridge forwarder ready")

    def _on_evidence(self, message: UInt32MultiArray) -> None:
        if self._submitted:
            return
        self._submitted = True
        request = Request(
            self.get_parameter("bridge_url").value,
            data=json.dumps(
                {"droneId": "MS-01", "evidence": list(message.data)}
            ).encode(),
            headers={"content-type": "application/json"},
            method="POST",
        )
        max_attempts = int(self.get_parameter("max_attempts").value)
        for attempt in range(1, max_attempts + 1):
            try:
                with urlopen(
                    request, timeout=float(self.get_parameter("timeout_seconds").value)
                ) as response:
                    result = response.read().decode()
                output = String()
                output.data = result
                self._result_publisher.publish(output)
                self.get_logger().info("Compact bridge verified checkpoint evidence")
                return
            except HTTPError as error:
                code = "BRIDGE_REJECTED"
                with suppress(json.JSONDecodeError, UnicodeDecodeError):
                    code = json.loads(error.read().decode()).get("error", code)
                if error.code not in (409, 503) or attempt == max_attempts:
                    self.get_logger().error(f"Compact bridge rejected submission: {code}")
                    return
            except (URLError, TimeoutError):
                if attempt == max_attempts:
                    self._submitted = False
                    self.get_logger().error("Compact bridge submission unavailable")
                    return
            time.sleep(min(2**attempt, 5))


def main(args=None) -> None:
    rclpy.init(args=args)
    node = BridgeForwarder()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
