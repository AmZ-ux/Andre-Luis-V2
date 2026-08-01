import { Outlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { Container } from '../ui/Container'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-secondary dark:bg-gray-950">
      <Sidebar />

      <div className="lg:ml-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        <main className="flex-1 py-6 sm:py-8">
          <Container>
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Container>
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
