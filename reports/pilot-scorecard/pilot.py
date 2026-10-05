"""Report-only calculations; no network, database credentials, or writes."""
from collections import Counter
from datetime import datetime
from math import ceil


def ratio(numerator, denominator):
    if not 0 <= numerator <= denominator:
        raise ValueError('Invalid subset counts')
    return numerator / denominator if denominator else None


def percentile_disc(values, p):
    if not 0 < p <= 1:
        raise ValueError('Percentile must be in (0,1]')
    return sorted(values)[ceil(p * len(values)) - 1] if values else None


def contribution(platform_net_cents, incremental_costs, jobs):
    """None means unavailable. Explicit zero must be supported, not assumed.

    Costs must be net platform-borne adjustments not already in settlement net:
    refunds_disputes, support, incentives, acquisition, variable_ops, taxes.
    Fixed corporate overhead is outside this contribution definition.
    """
    keys = {'refunds_disputes', 'support', 'incentives', 'acquisition', 'variable_ops', 'taxes'}
    if jobs <= 0 or platform_net_cents is None or set(incremental_costs) != keys:
        return None
    if any(value is None for value in incremental_costs.values()):
        return None
    return (platform_net_cents - sum(incremental_costs.values())) / jobs / 100


def reconcile(bookings, events, environment='synthetic'):
    """Synthetic oracle for the SQL request-cohort reconciliation rules.

    Caller supplies scoped bookings and events before the as-of cutoff.
    IDs are synthetic fixtures only; outputs contain counts, never identities.
    """
    rows = {b['id']: b for b in bookings}
    if len(rows) != len(bookings):
        raise ValueError('Duplicate booking IDs')
    unique = {}
    for event in events:
        if event['id'] in unique and unique[event['id']] != event:
            raise ValueError('Conflicting event retry')
        unique[event['id']] = event
    accepted = [e for e in unique.values() if e['environment'] == environment
                and e['source'] == 'server' and e.get('origin') != 'client'
                and not e.get('internal') and e.get('role') != 'ops']
    counts = Counter((e.get('booking_id'), e['name']) for e in accepted)
    expected = [b for b in bookings if not b.get('generated_recurring')]
    latencies = []
    negative = 0
    for b in bookings:
        confirmations = [datetime.fromisoformat(e['at']) for e in accepted
                         if e.get('booking_id') == b['id'] and e['name'] == 'booking_confirmed']
        if confirmations:
            hours = (min(confirmations) - datetime.fromisoformat(b['requested_at'])).total_seconds()/3600
            if hours < 0:
                negative += 1
            else:
                latencies.append(hours)
    return {
        'expected_request_jobs': len(expected),
        'matched_request_jobs': sum(counts[b['id'], 'booking_requested'] > 0 for b in expected),
        'missing_request_jobs': sum(counts[b['id'], 'booking_requested'] == 0 for b in expected),
        'duplicate_request_jobs': sum(counts[b['id'], 'booking_requested'] > 1 for b in bookings),
        'missing_completion_jobs': sum(bool(b.get('completed_at')) and counts[b['id'], 'booking_completed'] == 0 for b in bookings),
        'orphan_events': sum(bool(e.get('booking_id')) and e['booking_id'] not in rows for e in accepted),
        'unattributable_events': sum(not e.get('booking_id') for e in accepted),
        'negative_latency_jobs': negative,
        'latency_n': len(latencies),
        'p50_hours': percentile_disc(latencies, .5),
        'p90_hours': percentile_disc(latencies, .9),
    }


def synthetic_fixture():
    at = '2026-09-01T12:00:00+00:00'
    bookings = [dict(id=f'synthetic-{n}', requested_at=at) for n in range(1, 5)]
    bookings[0]['completed_at'] = '2026-09-02T12:00:00+00:00'
    bookings[3]['generated_recurring'] = True
    def event(i, booking, name, hour=12, **kwargs):
        return dict(id=f'event-{i}', booking_id=booking, name=name,
                    at=f'2026-09-01T{hour:02}:00:00+00:00', environment='synthetic',
                    source='server', **kwargs)
    events = [event(1, 'synthetic-1', 'booking_requested'),
              event(2, 'synthetic-2', 'booking_requested'),
              event(3, 'synthetic-2', 'booking_requested'),
              event(4, 'synthetic-1', 'booking_confirmed', 13),
              event(5, 'synthetic-2', 'booking_confirmed', 16),
              event(6, 'synthetic-3', 'booking_requested', origin='client'),
              event(7, 'missing-synthetic', 'booking_requested')]
    events.append(events[0].copy())  # delivery retry, same event ID
    return bookings, events
