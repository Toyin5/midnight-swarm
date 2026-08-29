import math
from dataclasses import dataclass

UINT32_MAX = (1 << 32) - 1


@dataclass(frozen=True)
class Bounds:
    min_x: int
    max_x: int
    min_y: int
    max_y: int

    def __post_init__(self) -> None:
        values = (self.min_x, self.max_x, self.min_y, self.max_y)
        if any(value < 0 or value > UINT32_MAX for value in values):
            raise ValueError("checkpoint bounds must fit Compact Uint<32>")
        if self.min_x > self.max_x or self.min_y > self.max_y:
            raise ValueError("checkpoint minimum cannot exceed maximum")

    def contains(self, x: int, y: int) -> bool:
        return self.min_x <= x <= self.max_x and self.min_y <= y <= self.max_y


def fixed_point(value: float, units_per_meter: int) -> int:
    if not math.isfinite(value):
        raise ValueError("position must be finite")
    if units_per_meter <= 0:
        raise ValueError("units_per_meter must be positive")
    result = round(value * units_per_meter)
    if result < 0 or result > UINT32_MAX:
        raise ValueError("position must fit Compact Uint<32>")
    return result


class ConsecutiveHitDetector:
    def __init__(self, bounds: Bounds, required_samples: int) -> None:
        if required_samples <= 0:
            raise ValueError("required_samples must be positive")
        self.bounds = bounds
        self.required_samples = required_samples
        self._hits = 0
        self.triggered = False

    def observe(self, x: int, y: int) -> bool:
        if self.triggered:
            return False
        self._hits = self._hits + 1 if self.bounds.contains(x, y) else 0
        if self._hits < self.required_samples:
            return False
        self.triggered = True
        return True
