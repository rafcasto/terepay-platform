const testimonials = [
  {
    name: 'Shahara',
    initials: 'S',
    avatarBg: 'bg-teal-400',
    quote: 'Your service is a great help to people.',
  },
  {
    name: 'Walter',
    initials: 'W',
    avatarBg: 'bg-sky-500',
    quote: 'Thank you so much TerePay. A big help — thumbs up!',
  },
  {
    name: 'Eric Arambulo',
    initials: 'E',
    avatarBg: 'bg-violet-500',
    quote: "I want to thank TerePay for helping my friend and me. You're such a blessing to us.",
  },
  {
    name: 'Lyn',
    initials: 'L',
    avatarBg: 'bg-amber-400',
    quote: 'Thank you for helping during times of need.',
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-[#00B3A4]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  return (
    <section className="py-20 px-6 bg-[#E6F9F8]/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#00B3A4]">
            Testimonials
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-[#0D1B2A]">
            What People Say About Us
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4"
            >
              <StarRating />
              <blockquote className="text-sm text-gray-600 leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full ${t.avatarBg} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
                >
                  {t.initials}
                </div>
                <p className="font-semibold text-sm text-[#0D1B2A]">{t.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
