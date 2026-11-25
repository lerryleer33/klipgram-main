import Navbar from '@/components/Navbar';
import DownloaderWorkbench from '@/components/DownloaderWorkbench';
import EditorialSections from '@/components/EditorialSections';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col text-[#1D1B18]">
      <Navbar />
      <main className="flex-1">
        <DownloaderWorkbench />
        <EditorialSections />
      </main>
    </div>
  );
}
