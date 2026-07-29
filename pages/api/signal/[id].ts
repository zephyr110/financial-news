import { getSignalById, getRelatedSignals } from '../../../lib/db';
import { getBacktestByIndustry } from '../../../lib/db';

/**
 * GET /api/signal/[id]
 *
 * Returns a single signal's full detail: signal body + related signals + industry backtest data.
 * Used by the signal detail page (/signal/[id]).
 */
export default async function handler(req, res) {
  const { id } = req.query;
  const signalId = Number(id);

  if (!Number.isFinite(signalId) || signalId < 1) {
    return res.status(400).json({ error: 'Invalid signal ID' });
  }

  try {
    const signal = await getSignalById(signalId);

    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    // Fetch related signals and backtest in parallel
    const [related, backtest] = await Promise.all([
      getRelatedSignals(
        signalId,
        (signal as any).industries || [],
        (signal as any).companies || [],
        5,
      ),
      getBacktestByIndustry(90),
    ]);

    // Filter backtest to only show industries relevant to this signal
    const signalIndustries: string[] = (signal as any).industries || [];
    const relevantBacktest = backtest.filter((b: any) => {
      if (!b.industry) return false;
      return signalIndustries.some((ind: string) =>
        b.industry === ind ||
        b.industry.includes(ind) ||
        ind.includes(b.industry)
      );
    });

    res.setHeader(
      'Cache-Control',
      's-maxage=3600, stale-while-revalidate=600',
    );
    res.status(200).json({
      signal,
      related: related || [],
      backtest: relevantBacktest,
    });
  } catch (error) {
    console.error(`[api/signal/${signalId}] Error:`, error);
    res.status(500).json({ error: 'Failed to fetch signal detail' });
  }
}
