const partners = ['OFX', 'OrbitRemit', 'DataZoo', 'FinTechNZ', 'Centrix'];

export default function PartnersSection() {
  return (
    <section className="py-16 px-6 bg-gray-50 border-y border-gray-100">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-10">
          Our Partners &amp; Accreditations
        </p>
        <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8">
          {partners.map((p) => (
            <div
              key={p}
              className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 shadow-sm hover:shadow-md hover:text-[#F5A523] hover:border-[#F5A523]/30 transition-all"
            >
              {p}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
