# -*- coding: utf-8 -*-
"""
Модуль 3. Оценка возможности реализации рисковой ситуации.
Использует ансамбль нечётких деревьев решений (fuzzytree).
Каждое дерево в ансамбле принимает решения на основе нечёткой логики.
"""

import os
import re
import sys
import numpy as np
from sklearn.utils import resample
from fuzzytree import FuzzyDecisionTreeClassifier

# АВТОМАТИЧЕСКИЙ ПАТЧ ДЛЯ СОВМЕСТИМОСТИ С НОВЫМИ ВЕРСИЯМИ SCIKIT-LEARN
def patch_fuzzytree():
    """
    Автоматически исправляет несовместимость fuzzytree с новыми версиями scikit-learn.
    Заменяет вызов _check_sample_weight(sample_weight, X, np.float64) на _check_sample_weight(sample_weight, X).
    """
    try:
        import fuzzytree
        module_path = os.path.dirname(fuzzytree.__file__)
        classes_file = os.path.join(module_path, '_classes.py')

        if not os.path.exists(classes_file):
            return

        with open(classes_file, 'r', encoding='utf-8') as f:
            content = f.read()

        pattern = r'_check_sample_weight\s*\(\s*sample_weight\s*,\s*X\s*,\s*np\.float64\s*\)'
        if re.search(pattern, content):
            new_content = re.sub(pattern, '_check_sample_weight(sample_weight, X)', content)
            with open(classes_file, 'w', encoding='utf-8') as f:
                f.write(new_content)

            pyc_file = classes_file + 'c'
            if os.path.exists(pyc_file):
                os.remove(pyc_file)
            print("✅ fuzzytree автоматически исправлен для совместимости с текущей версией scikit-learn.")
        else:
            pass
    except Exception as e:
        print(f"⚠️ Не удалось автоматически исправить fuzzytree: {e}")

patch_fuzzytree()

def prepare_features_for_model(df_processed, metadata):
    """
    Подготавливает признаки для модели: кодирует категориальные,
    оставляет числовые как есть (нечёткое дерево само обработает).
    """
    cat_encoded = [col for col in df_processed.columns if col.endswith('_encoded')]
    numeric_cols = metadata.get('numeric_features', [])
    numeric_cols = [col for col in numeric_cols if col in df_processed.columns]
    X = df_processed[cat_encoded + numeric_cols]
    y = df_processed[metadata['target']]
    return X, y, df_processed


def build_single_fuzzy_tree(X_train, y_train, max_depth, random_state, feature_indices):
    """
    Строит одно нечёткое дерево на подвыборке признаков.
    Возвращает (tree, indices)
    """
    if hasattr(X_train, 'values'):
        X_train = X_train.values
    if hasattr(y_train, 'values'):
        y_train = y_train.values

    # Устанавливаем seed для воспроизводимости
    np.random.seed(random_state)

    n_features = X_train.shape[1]
    # Выбираем случайный набор признаков
    feat_idx = np.random.choice(n_features, size=feature_indices, replace=False)
    X_sub = X_train[:, feat_idx]

    # Bootstrap-выборка (используем 80% данных)
    sample_size = int(len(X_train) * 0.8)
    indices = np.random.choice(len(X_train), size=sample_size, replace=True)
    X_boot = X_sub[indices]
    y_boot = y_train[indices]

    tree = FuzzyDecisionTreeClassifier(max_depth=max_depth)
    tree.fit(X_boot, y_boot)
    return tree, feat_idx


def build_fuzzy_ensemble(X_train, y_train, n_estimators=30, max_depth=6, random_state=42):
    """
    Строит ансамбль нечётких деревьев.

    Параметры:
    - X_train: признаки для обучения (DataFrame или numpy array)
    - y_train: целевая переменная
    - n_estimators: количество деревьев
    - max_depth: максимальная глубина каждого дерева
    - random_state: начальное seed для воспроизводимости

    Возвращает:
    - ensemble: список обученных деревьев
    - feature_indices: список индексов признаков для каждого дерева
    """
    if hasattr(X_train, 'values'):
        X_train = X_train.values
    if hasattr(y_train, 'values'):
        y_train = y_train.values

    n_features = X_train.shape[1]
    max_features = int(n_features * 0.7)
    if max_features < 1:
        max_features = 1

    ensemble = []
    feature_indices = []
    for i in range(n_estimators):
        tree, idx = build_single_fuzzy_tree(X_train, y_train, max_depth, random_state + i, max_features)
        ensemble.append(tree)
        feature_indices.append(idx)
    return ensemble, feature_indices


def predict_fuzzy_ensemble(ensemble, X, feature_indices):
    """
    Выполняет предсказание с использованием ансамбля нечётких деревьев.
    """
    if hasattr(X, 'values'):
        X = X.values

    n_samples = X.shape[0]
    n_trees = len(ensemble)
    probas = np.zeros((n_samples, n_trees))

    for i, (tree, idx) in enumerate(zip(ensemble, feature_indices)):
        X_sub = X[:, idx]
        probas[:, i] = tree.predict_proba(X_sub)[:, 1]

    return np.mean(probas, axis=1)
