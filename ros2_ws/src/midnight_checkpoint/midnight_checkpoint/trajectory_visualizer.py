import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import rclpy
from geometry_msgs.msg import PoseStamped
from matplotlib.animation import FuncAnimation, PillowWriter
from rclpy.node import Node
from std_msgs.msg import String


class TrajectoryVisualizer(Node):
    """Renders ROS poses and marks the animation verified by the Midnight result."""

    def __init__(self) -> None:
        super().__init__("trajectory_visualizer")
        self.declare_parameter("pose_topic", "/drone/private_pose")
        self.declare_parameter("result_topic", "/midnight/checkpoint_result")
        self.declare_parameter("target_x", 52.0)
        self.declare_parameter("target_y", 81.0)
        self.declare_parameter("target_z", 20.0)
        self.declare_parameter("output_directory", "/demo-output")
        self.declare_parameter("animation_fps", 5)

        self._target = tuple(
            float(self.get_parameter(name).value)
            for name in ("target_x", "target_y", "target_z")
        )
        self._positions: list[tuple[float, float, float]] = []
        self._rendered = False
        self._output = Path(self.get_parameter("output_directory").value)
        self._output.mkdir(parents=True, exist_ok=True)
        self.create_subscription(
            PoseStamped, self.get_parameter("pose_topic").value, self._on_pose, 10
        )
        self.create_subscription(
            String, self.get_parameter("result_topic").value, self._on_result, 1
        )
        self.get_logger().info("3D trajectory recorder ready")

    def _on_pose(self, message: PoseStamped) -> None:
        point = message.pose.position
        self._positions.append((point.x, point.y, point.z))
        self._render_frame(self._output / "trajectory-current.png", len(self._positions) - 1)

    def _on_result(self, message: String) -> None:
        try:
            verified = json.loads(message.data).get("status") == "verified"
        except (json.JSONDecodeError, AttributeError):
            verified = False
        if verified and not self._rendered:
            self._rendered = True
            self._render_animation()

    def _axes(self, title: str):
        figure = plt.figure(figsize=(8, 6))
        axes = figure.add_subplot(111, projection="3d")
        axes.set_title(title)
        axes.set_xlabel("X")
        axes.set_ylabel("Y")
        axes.set_zlabel("Z")
        maxima = [max(1.0, coordinate * 1.15) for coordinate in self._target]
        axes.set_xlim(0, maxima[0])
        axes.set_ylim(0, maxima[1])
        axes.set_zlim(0, maxima[2])
        axes.scatter(*self._target, color="green", s=100, label="Target")
        return figure, axes

    def _render_frame(self, path: Path, index: int) -> None:
        figure, axes = self._axes("Drone checkpoint trajectory")
        points = self._positions[: index + 1]
        xs, ys, zs = zip(*points, strict=True)
        axes.plot(xs, ys, zs, color="red", alpha=0.35)
        axes.scatter(xs[-1], ys[-1], zs[-1], color="red", s=70, label="Current position")
        axes.legend()
        figure.tight_layout()
        figure.savefig(path)
        plt.close(figure)

    def _render_animation(self) -> None:
        positions = tuple(self._positions)
        figure, axes = self._axes("Midnight verified drone checkpoint")
        trail, = axes.plot([], [], [], color="red", alpha=0.35)
        current = axes.scatter([], [], [], color="red", s=70, label="Current position")
        axes.legend()

        def update(index: int):
            xs, ys, zs = zip(*positions[: index + 1], strict=True)
            trail.set_data_3d(xs, ys, zs)
            current._offsets3d = ([xs[-1]], [ys[-1]], [zs[-1]])
            return trail, current

        animation = FuncAnimation(figure, update, frames=len(positions), interval=200, blit=False)
        path = self._output / "midnight-checkpoint.gif"
        fps = int(self.get_parameter("animation_fps").value)
        animation.save(path, writer=PillowWriter(fps=fps))
        plt.close(figure)
        self.get_logger().info(f"Midnight-verified 3D animation saved to {path}")


def main(args=None) -> None:
    rclpy.init(args=args)
    node = TrajectoryVisualizer()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
