import math
import unittest

from midnight_checkpoint.geometry import Bounds, ConsecutiveHitDetector, fixed_point


class GeometryTest(unittest.TestCase):
    def test_requires_consecutive_in_bounds_samples(self) -> None:
        detector = ConsecutiveHitDetector(Bounds(40, 60, 70, 90), required_samples=3)

        self.assertFalse(detector.observe(52, 81))
        self.assertFalse(detector.observe(61, 81))
        self.assertFalse(detector.observe(52, 81))
        self.assertFalse(detector.observe(53, 82))
        self.assertTrue(detector.observe(54, 83))
        self.assertFalse(detector.observe(54, 83))

    def test_checkpoint_edges_are_inclusive(self) -> None:
        bounds = Bounds(40, 60, 70, 90)
        self.assertTrue(bounds.contains(40, 70))
        self.assertTrue(bounds.contains(60, 90))

    def test_rejects_non_finite_positions(self) -> None:
        for value in (math.nan, math.inf, -math.inf):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "finite"):
                fixed_point(value, 1)

    def test_rejects_negative_compact_coordinate(self) -> None:
        with self.assertRaisesRegex(ValueError, "Uint"):
            fixed_point(-0.1, 100)

    def test_scales_position_for_compact(self) -> None:
        self.assertEqual(fixed_point(0.52, 100), 52)


if __name__ == "__main__":
    unittest.main()
