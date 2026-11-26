import unittest

from app.result import LABELS, map_rows


class ResultMappingTests(unittest.TestCase):
    def test_six_classes_preserve_coco_six_and_exclude_background(self):
        rows = [(i, 0.8, (1.0, 2.0, 20.0, 30.0)) for i in range(7)]
        result = map_rows(rows, 100, 100)
        items = result["evaluation"]["detections"]
        self.assertEqual(len(items), 6)
        self.assertEqual([d["category"]["coco_category_id"] for d in items], [1, 2, 3, 4, 5, 6])
        self.assertEqual(items[5]["category"]["original_label"], LABELS[5][0])

    def test_exact_threshold_and_zero_detections(self):
        self.assertEqual(map_rows([], 10, 10)["evaluation"]["status"], "evaluated_no_detections")
        with self.assertRaisesRegex(ValueError, "confidence"):
            map_rows([(0, 0.35, (1, 1, 2, 2))], 10, 10)

    def test_rejects_invalid_boxes_and_limits_to_contract_max(self):
        with self.assertRaisesRegex(ValueError, "bounding_box"):
            map_rows([(0, 0.9, (2, 2, 1, 3))], 10, 10)
        result = map_rows([(0, 0.9, (1, 1, 2, 2))] * 101, 10, 10)
        self.assertEqual(result["evaluation"]["status"], "partially_evaluated")
        self.assertEqual(len(result["evaluation"]["detections"]), 100)


if __name__ == "__main__":
    unittest.main()
