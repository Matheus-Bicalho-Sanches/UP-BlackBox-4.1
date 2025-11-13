'use client';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

type FAQListProps = {
  items: FAQItem[];
};

export const FAQList = ({ items }: FAQListProps) => {
  return (
    <div className="space-y-6">
      {items.map((faq) => (
        <div key={faq.id} className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">{faq.question}</h3>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
        </div>
      ))}
    </div>
  );
};

export default FAQList;

