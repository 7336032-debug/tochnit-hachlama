// Single-month amortization step for an interest-bearing loan.
// interest accrues first (balance * monthly rate), then payment is applied.
export function monthlyStep(balance, annualRatePct, payment) {
  const monthlyRate = (annualRatePct || 0) / 100 / 12;
  const interest = balance * monthlyRate;
  const owed = balance + interest;
  const applied = Math.min(payment, owed);
  const newBalance = Math.max(0, owed - applied);
  return { interest, applied, newBalance };
}
