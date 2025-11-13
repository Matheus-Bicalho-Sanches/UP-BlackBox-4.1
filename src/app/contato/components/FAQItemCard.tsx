'use client';

type FAQItemCardProps = {
  question: string;
  answer: string;
};

export const FAQItemCard = ({ question, answer }: FAQItemCardProps) => {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow">
      <h3 className="text-base font-semibold text-gray-900">{question}</h3>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{answer}</p>
    </article>
  );
};

export default FAQItemCard;

