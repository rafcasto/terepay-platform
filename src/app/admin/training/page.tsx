import TrainingConsole from './_components/TrainingConsole';

export default function AdminTrainingPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Model Training</h1>
        <p className="text-sm text-slate-500 mt-1">
          Feed historical applications to the credit-assessment engine, backtest its thresholds against real
          outcomes and fine-tune the analyst model. Jobs run on the assessment worker; nothing here changes a live
          decision until a new model is switched on in the worker configuration.
        </p>
      </div>
      <TrainingConsole />
    </div>
  );
}
