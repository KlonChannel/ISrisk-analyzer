# -*- coding: utf-8 -*-
"""
Модуль 1. Сбор и нормализация входных данных
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split

def generate_or_load_data(source='generate', file_path=None, scenario='balanced', n_samples=2000):
    """
    Генерация или загрузка данных
    """
    if source == 'generate':
        np.random.seed(42)
        departments = ['IT_Ops', 'DevOps', 'Finance', 'HR', 'Development', 'Security']
        event_types = ['Auth_Attempt', 'File_Access', 'Network_Connection', 'DB_Query', 'Config_Change', 'VPN_Connect']

        df = pd.DataFrame({
            'timestamp': pd.date_range('2025-01-01', periods=n_samples, freq='5min'),
            'department': np.random.choice(departments, n_samples),
            'event_type': np.random.choice(event_types, n_samples),
            'cvss_score': np.random.uniform(2, 9.5, n_samples),
            'asset_criticality': np.random.choice([1,2,3,4,5], n_samples, p=[0.1,0.2,0.3,0.25,0.15]),
            'hour_of_day': np.random.randint(0,24,n_samples),
            'anomaly_frequency': np.random.poisson(3,n_samples),
            'access_attempts': np.random.negative_binomial(2,0.3,n_samples)+1,
            'network_load_mbps': np.random.exponential(50,n_samples),
            'prev_incidents_week': np.random.poisson(1.5,n_samples),
        })

        # Расчёт риска
        risk_score = ( (df['cvss_score']/10)*0.4 + (df['anomaly_frequency']/10)*0.2 +
                       (df['asset_criticality']/5)*0.2 + (df['prev_incidents_week']/5)*0.1 +
                       (df['network_load_mbps']/200)*0.1 )

        # Для сбалансированного режима смещаем распределение к 0.5
        if scenario == 'balanced':
            # Сдвигаем риск к 0.5 и добавляем шум, чтобы получить ~50% инцидентов
            risk_score = 0.5 + (risk_score - risk_score.mean()) * 0.5
            noise = np.random.normal(0, 0.1, n_samples)
        elif scenario == 'high_risk':
            noise = np.random.normal(0.3, 0.1, n_samples)
        elif scenario == 'low_risk':
            noise = np.random.normal(-0.3, 0.1, n_samples)
        else:
            noise = np.random.normal(0, 0.15, n_samples)

        risk_score = np.clip(risk_score + noise, 0, 1)
        # Целевая переменная – инцидент с вероятностью risk_score
        df['incident_flag'] = (np.random.random(n_samples) < risk_score).astype(int)

        # Категория ущерба (для справки)
        damage_map = {'Auth_Attempt':'High','File_Access':'Medium','Network_Connection':'Low',
                      'DB_Query':'Critical','Config_Change':'Medium','VPN_Connect':'Low'}
        df['inherent_damage_label'] = df['event_type'].map(damage_map)

        # Для сбалансированного режима убедимся, что ~50% инцидентов
        if scenario == 'balanced' and df['incident_flag'].mean() < 0.45:
            # Дополнительная корректировка: пересэмплируем часть записей
            extra = df[df['incident_flag']==0].sample(n=int(n_samples*0.1), replace=False)
            extra['incident_flag'] = 1
            df = pd.concat([df, extra]).sample(frac=1).reset_index(drop=True)
            # Убедимся, что общее количество не превышает n_samples (обрежем до n_samples)
            if len(df) > n_samples:
                df = df.sample(n=n_samples).reset_index(drop=True)

        metadata = {
            'numeric_features': ['cvss_score','asset_criticality','hour_of_day','anomaly_frequency',
                                 'access_attempts','network_load_mbps','prev_incidents_week'],
            'categorical_features': ['department','event_type','inherent_damage_label'],
            'target': 'incident_flag',
            'timestamp': 'timestamp'
        }
        return df, metadata
    else:
        df = pd.read_csv(file_path)
        metadata = {}
        return df, metadata

def normalize_data(df, metadata):
    """
    Нормализация данных: кодирование категорий, масштабирование числовых признаков
    """
    df_processed = df.copy()
    encoders = {}
    scaler = StandardScaler()

    # Кодирование категорий
    for col in metadata.get('categorical_features', []):
        if col in df_processed.columns:
            le = LabelEncoder()
            df_processed[col + '_encoded'] = le.fit_transform(df_processed[col].astype(str))
            encoders[col] = le

    # Масштабирование числовых признаков
    num_cols = [col for col in metadata.get('numeric_features', []) if col in df_processed.columns]
    if num_cols:
        df_processed[num_cols] = scaler.fit_transform(df_processed[num_cols])
        encoders['scaler'] = scaler

    # Удаление оригинальных категориальных колонок
    for col in metadata.get('categorical_features', []):
        if col in df_processed.columns and col != 'timestamp' and col != 'incident_flag':
            df_processed.drop(columns=[col], inplace=True)

    return df_processed, encoders

def split_data(df_processed, target_col, test_size=0.3, random_state=42):
    X = df_processed.drop(columns=[target_col, 'timestamp'] if 'timestamp' in df_processed.columns else [target_col])
    y = df_processed[target_col]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size,
                                                        random_state=random_state, stratify=y)
    return X_train, X_test, y_train, y_test
