"""Reglas de negocio puras. Los valores de adjusted_frequency deben coincidir con la app (JavaScript)."""
from datetime import date, timedelta

from plants.logic import (
    adjusted_frequency,
    agenda_status,
    days_until_due,
    effective_streak,
    next_streak,
)

D = date(2026, 10, 26)


def test_adjusted_frequency_matches_the_mobile_app():
    expected = {
        (7, 'baja'): 9, (7, 'media'): 7, (7, 'alta'): 6,
        (5, 'baja'): 7,   # 6.5 -> 7: Math.round de JS (round() de Python daría 6)
        (5, 'alta'): 4, (3, 'alta'): 2, (12, 'alta'): 10, (14, 'alta'): 11, (14, 'baja'): 18,
    }
    for (base, light), days in expected.items():
        assert adjusted_frequency(base, light) == days, (base, light)


def test_adjusted_frequency_never_below_one_and_unknown_light_is_neutral():
    assert adjusted_frequency(1, 'alta') == 1
    assert adjusted_frequency(7, None) == 7
    assert adjusted_frequency(7, '') == 7
    assert adjusted_frequency(7, 'rara') == 7


def test_streak_first_watering():
    assert next_streak(0, 0, None, D) == (1, 1, D)


def test_streak_consecutive_days_accumulate():
    state = (0, 0, None)
    for offset in range(4):
        state = next_streak(*state, D + timedelta(days=offset))
    assert state == (4, 4, D + timedelta(days=3))


def test_streak_same_day_does_not_count_twice():
    assert next_streak(3, 3, D, D) == (3, 3, D)


def test_streak_breaks_after_a_gap_but_keeps_the_best():
    assert next_streak(5, 5, D, D + timedelta(days=3)) == (1, 5, D + timedelta(days=3))


def test_streak_ignores_late_arriving_older_events():
    assert next_streak(2, 4, D, D - timedelta(days=5)) == (2, 4, D)


def test_effective_streak_stays_alive_today_or_yesterday_only():
    assert effective_streak(5, D, D) == 5
    assert effective_streak(5, D - timedelta(days=1), D) == 5
    assert effective_streak(5, D - timedelta(days=2), D) == 0
    assert effective_streak(0, None, D) == 0


def test_days_until_due_and_status():
    assert days_until_due(None, 7, D) == 0
    assert days_until_due(D - timedelta(days=8), 7, D) == -1
    assert days_until_due(D - timedelta(days=7), 7, D) == 0
    assert days_until_due(D - timedelta(days=3), 7, D) == 4
    assert [agenda_status(n) for n in (-2, 0, 3)] == ['atrasada', 'hoy', 'ok']
