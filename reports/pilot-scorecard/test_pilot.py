import unittest
from datetime import datetime
from zoneinfo import ZoneInfo
from pilot import ratio, percentile_disc, contribution, reconcile, synthetic_fixture

class PilotTests(unittest.TestCase):
    def test_reconciliation_detects_losses_duplicates_and_orphans(self):
        result = reconcile(*synthetic_fixture())
        self.assertEqual(result, dict(expected_request_jobs=3, matched_request_jobs=2,
            missing_request_jobs=1, duplicate_request_jobs=1, missing_completion_jobs=1,
            orphan_events=1, unattributable_events=0, negative_latency_jobs=0,
            latency_n=2, p50_hours=1, p90_hours=4))

    def test_empty_is_unavailable(self):
        self.assertIsNone(ratio(0, 0))
        self.assertIsNone(percentile_disc([], .9))
        with self.assertRaises(ValueError): ratio(2, 1)

    def test_costs_cannot_default_to_zero(self):
        self.assertIsNone(contribution(1000, {}, 2))
        costs = dict.fromkeys(['refunds_disputes','support','incentives','acquisition','variable_ops','taxes'], 0)
        costs['support'] = 400
        self.assertEqual(contribution(1000, costs, 2), 3)
        costs['taxes'] = None
        self.assertIsNone(contribution(1000, costs, 2))

    def test_environment_internal_and_ops_are_excluded(self):
        b, e = synthetic_fixture()
        for i, extra in enumerate([{'environment':'production'}, {'internal':True}, {'role':'ops'}, {'source':'client'}]):
            e.append(dict(e[0], id=f'excluded-{i}', booking_id='synthetic-3', **extra))
        self.assertEqual(reconcile(b,e)['missing_request_jobs'],1)

    def test_negative_latency_and_conflicting_retry(self):
        b, e = synthetic_fixture()
        e.append(dict(e[3], id='early', at='2026-09-01T11:00:00+00:00'))
        self.assertEqual(reconcile(b,e)['negative_latency_jobs'],1)
        self.assertEqual(reconcile(b,e)['latency_n'],1)
        e.append(dict(e[0], booking_id='different'))
        with self.assertRaises(ValueError): reconcile(b,e)

    def test_dst_calendar_week_is_not_always_168_hours(self):
        ny = ZoneInfo('America/New_York')
        a = datetime(2026,10,26,tzinfo=ny).astimezone(ZoneInfo('UTC'))
        b = datetime(2026,11,2,tzinfo=ny).astimezone(ZoneInfo('UTC'))
        self.assertEqual((b-a).total_seconds()/3600,169)

if __name__ == '__main__': unittest.main()
