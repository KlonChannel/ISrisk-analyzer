# -*- coding: utf-8 -*-
"""
Модуль 4. Вычисление совокупного риска и ранжирование
"""

import numpy as np

def compute_aggregate_risk(probabilities, damage_estimates, mode='default'):
    risks = np.array(probabilities) * np.array(damage_estimates)
    if mode == 'balanced':
        rmin = float(risks.min())
        rmax = float(risks.max())
        if rmax > rmin:
            risks = 5.0 + (risks - rmin) / (rmax - rmin) * 70.0
        else:
            risks = np.full_like(risks, 40.0)
    def categorize(r):
        if r < 20:
            return 'Низкий'
        elif r < 40:
            return 'Средний'
        elif r < 60:
            return 'Высокий'
        else:
            return 'Критический'
    categories = [categorize(r) for r in risks]
    return risks, categories

def rank_risks(risk_scores, ids=None):
    if ids is None:
        ids = list(range(len(risk_scores)))
    sorted_pairs = sorted(zip(ids, risk_scores), key=lambda x: x[1], reverse=True)
    return sorted_pairs
