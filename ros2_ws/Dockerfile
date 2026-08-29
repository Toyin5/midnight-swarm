FROM ros:lyrical-ros-base AS builder

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
WORKDIR /opt/midnight-swarm/ros2_ws

COPY ros2_ws/src ./src

RUN apt-get update \
    && rosdep update --rosdistro "${ROS_DISTRO}" \
    && rosdep install --from-paths src --ignore-src --rosdistro "${ROS_DISTRO}" \
        --skip-keys ament_python -y \
    && rm -rf /var/lib/apt/lists/*

RUN source "/opt/ros/${ROS_DISTRO}/setup.bash" \
    && colcon build --merge-install --install-base /opt/midnight-swarm/ros-install

FROM ros:lyrical-ros-base AS runtime

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3-matplotlib python3-numpy python3-pil \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /opt/midnight-swarm/ros-install /opt/midnight-swarm/ros-install
COPY ros2_ws/ros-entrypoint.sh /ros-entrypoint.sh
RUN chmod 755 /ros-entrypoint.sh

ENV PYTHONUNBUFFERED=1
ENTRYPOINT ["/ros-entrypoint.sh"]
CMD ["ros2", "launch", "midnight_checkpoint", "synthetic_checkpoint.launch.py"]
