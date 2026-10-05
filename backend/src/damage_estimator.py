# -*- coding: utf-8 -*-
"""
Модуль 2. Экспертное задание потенциального ущерба
"""

class ExpertDamageEstimator:
    def __init__(self, categories=None, default_weights=None):
        if categories is None:
            self.categories = ['financial', 'reputational', 'operational', 'legal', 'data_loss']
        else:
            self.categories = categories

        if default_weights is None:
            self.weights = {cat: 1/len(self.categories) for cat in self.categories}
        else:
            self.weights = default_weights
            total = sum(self.weights.values())
            if total != 1:
                self.weights = {k: v/total for k, v in self.weights.items()}

        self.damage_scores = {}  # event_id -> {category: value}

    def set_weights(self, new_weights):
        self.weights = new_weights
        total = sum(self.weights.values())
        if total != 1:
            self.weights = {k: v/total for k, v in self.weights.items()}

    def set_damage_for_event(self, event_id, scores):
        ling_to_num = {'низкий': 20, 'средний': 50, 'высокий': 80, 'критический': 95}
        numeric_scores = {}
        for cat, val in scores.items():
            if isinstance(val, str) and val.lower() in ling_to_num:
                numeric_scores[cat] = ling_to_num[val.lower()]
            else:
                numeric_scores[cat] = float(val)
        self.damage_scores[event_id] = numeric_scores

    def get_aggregated_damage(self, event_id):
        if event_id not in self.damage_scores:
            return None
        scores = self.damage_scores[event_id]
        total = 0
        for cat, w in self.weights.items():
            total += w * scores.get(cat, 0)
        return total
