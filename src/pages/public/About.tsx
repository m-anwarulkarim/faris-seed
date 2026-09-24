

import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { Section, SectionHeading } from "@/components/pub/section";


function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Section spacing="lg" width="narrow">
          <SectionHeading
            eyebrow="আমাদের সম্পর্কে"
            title="ভালো বীজ থেকেই ভালো ফসল"
            description="আমরা দেশ-বিদেশের নির্ভরযোগ্য উৎস থেকে বীজ সংগ্রহ করি, ল্যাব-টেস্টেড germination rate যাচাই করি, তারপরই তা আপনার হাতে পৌঁছে দিই।"
          />
          <p className="mt-8 text-base leading-relaxed text-muted-foreground">
            এই পেজের বিস্তারিত কনটেন্ট পরের ধাপে যোগ করা হবে।
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

export default AboutPage;
