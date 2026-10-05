# -*- coding: utf-8 -*-
"""
Модуль 5. Интерпретация и формирование рекомендаций
"""

def generate_recommendation(risk_level, event_type=None, department=None, cvss_score=None):
    """
    Генерирует рекомендацию на основе уровня риска и дополнительных параметров.
    """
    base_recs = {
        'Низкий': ('Принять риск', 'Мониторить в рамках обычного режима. Дополнительные меры не требуются.'),
        'Средний': ('Минимизировать риск', 'Внедрить дополнительные средства защиты, усилить мониторинг.'),
        'Высокий': ('Передать риск', 'Рассмотреть страхование или аутсорсинг защиты. Применить активные меры реагирования.'),
        'Критический': ('Уклониться от риска', 'Изменить бизнес-процесс или отказаться от рискованной деятельности. Немедленные действия.')
    }

    detailed_measures = {
        'Auth_Attempt': 'Внедрить многофакторную аутентификацию, усилить политику паролей, использовать SIEM для обнаружения аномалий входа.',
        'File_Access': 'Настроить контроль доступа на основе ролей (RBAC), вести логирование всех обращений к файлам, использовать DLP-системы.',
        'Network_Connection': 'Установить межсетевой экран (Firewall), использовать IDS/IPS, сегментировать сеть, ограничить нежелательные соединения.',
        'DB_Query': 'Применить шифрование данных, настроить аудит запросов, использовать параметризованные запросы для защиты от SQL-инъекций.',
        'Config_Change': 'Внедрить систему управления конфигурациями (CMDB), проводить регулярные аудиты, использовать Ansible/Terraform для контроля изменений.',
        'VPN_Connect': 'Усилить политику VPN, использовать современные протоколы шифрования (IPsec/OpenVPN), ограничить время сессии.'
    }

    dept_measures = {
        'IT_Ops': 'Усилить мониторинг инфраструктуры, внедрить автоматическое восстановление после сбоев.',
        'DevOps': 'Внедрить DevSecOps, проводить сканирование кода на уязвимости, использовать безопасные репозитории.',
        'Finance': 'Ограничить доступ к финансовым данным, использовать шифрование, проводить регулярные проверки на соответствие PCI DSS.',
        'HR': 'Защитить персональные данные, внедрить политику конфиденциальности, использовать шифрование при передаче данных.',
        'Development': 'Проводить статический и динамический анализ кода, использовать безопасные фреймворки, обновлять библиотеки.',
        'Security': 'Усилить политику безопасности, проводить пентесты, обучать сотрудников основам кибербезопасности.'
    }

    strategy, detail = base_recs.get(risk_level, ('Не определено', 'Проконсультируйтесь с экспертом.'))

    measures = []
    if event_type and event_type in detailed_measures:
        measures.append(detailed_measures[event_type])
    if department and department in dept_measures:
        measures.append(dept_measures[department])

    if cvss_score and cvss_score > 7:
        measures.append('Учитывая высокий CVSS-скор, приоритизировать исправление уязвимости в течение 48 часов.')
    elif cvss_score and cvss_score > 4:
        measures.append('Учитывая средний CVSS-скор, запланировать исправление в ближайший плановый релиз.')

    if measures:
        detail += ' Рекомендуемые меры: ' + ' '.join(measures)

    return strategy, detail

def prepare_report(risks, ids, descriptions=None, df=None):
    """
    Формирует расширенный отчёт с рекомендациями и описанием уязвимостей.
    """
    report = []
    for idx, risk_val in zip(ids, risks):
        if risk_val < 20:
            level = 'Низкий'
        elif risk_val < 40:
            level = 'Средний'
        elif risk_val < 60:
            level = 'Высокий'
        else:
            level = 'Критический'

        event_type = None
        department = None
        cvss = None
        if df is not None and idx < len(df):
            row = df.iloc[idx]
            event_type = row.get('event_type', None)
            department = row.get('department', None)
            cvss = row.get('cvss_score', None)

        strategy, detail = generate_recommendation(level, event_type, department, cvss)

        vulnerability_desc = f"Выявлена уязвимость в ИТ-архитектуре: "
        if event_type and department:
            vulnerability_desc += f"обнаружены подозрительные {event_type} в отделе {department}. "
        else:
            vulnerability_desc += f"обнаружена потенциальная угроза (уровень риска: {level}). "

        if cvss and cvss > 7:
            vulnerability_desc += f"CVSS-оценка {cvss:.1f} указывает на высокую критичность. "
        elif cvss and cvss > 4:
            vulnerability_desc += f"CVSS-оценка {cvss:.1f} требует внимания. "
        else:
            vulnerability_desc += "Рекомендуется проведение дополнительного анализа. "

        entry = {
            'id': idx + 1,
            'risk_score': risk_val,
            'risk_level': level,
            'strategy': strategy,
            'detail': detail,
            'vulnerability_description': vulnerability_desc,
            'description': descriptions[idx] if descriptions and idx < len(descriptions) else f"Событие №{idx + 1}"
        }
        report.append(entry)
    return report
