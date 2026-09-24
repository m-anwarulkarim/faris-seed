
import { Mail, MapPin, Phone } from "lucide-react";

import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { Card, CardContent } from "@/components/pub/card";
import { Section, SectionHeading } from "@/components/pub/section";


const items = [
  { Icon: Phone, label: "ফোন / WhatsApp", value: "+8801897492635" },
  { Icon: Mail, label: "ইমেইল", value: "shopfaris01@gmail.com" },
  { Icon: MapPin, label: "ঠিকানা", value: "Chand Mia, Housing,Mohammadpur,Dhaka-1207" },
];

function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Section spacing="lg">
          <SectionHeading
            eyebrow="যোগাযোগ"
            title="আমরা সকাল ৯টা – রাত ৯টা পর্যন্ত available"
            description="অর্ডার, ডেলিভারি বা চাষের পরামর্শ — যেকোনো প্রশ্নে সরাসরি কল করুন।"
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {items.map(({ Icon, label, value }) => (
              <Card key={label}>
                <CardContent className="flex flex-col gap-3 p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-5" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="font-display text-base font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

export default ContactPage;
