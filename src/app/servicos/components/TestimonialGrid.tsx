'use client';

type Testimonial = {
  id: string;
  quote: string;
  author: string;
  role: string;
};

type TestimonialGridProps = {
  testimonials: Testimonial[];
};

export const TestimonialGrid = ({ testimonials }: TestimonialGridProps) => {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {testimonials.map((testimonial) => (
        <blockquote
          key={testimonial.id}
          className="h-full rounded-3xl border border-slate-200 bg-white/90 p-8 text-gray-700 shadow"
        >
          <p className="text-base leading-relaxed">“{testimonial.quote}”</p>
          <footer className="mt-6 border-t border-slate-200 pt-4 text-sm font-semibold text-gray-900">
            {testimonial.author}
            <span className="block text-xs font-normal uppercase tracking-wide text-slate-500">
              {testimonial.role}
            </span>
          </footer>
        </blockquote>
      ))}
    </div>
  );
};

export default TestimonialGrid;

