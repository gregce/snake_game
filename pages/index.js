import Head from 'next/head'
import dynamic from 'next/dynamic'
import styles from '../styles/Home.module.css'

// Import the game component with dynamic loading and no SSR
const SnakeGame = dynamic(() => import('../components/SnakeGame'), {
  ssr: false,
})

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Voxel Viper - 3D Snake Adventure</title>
        <meta name="description" content="Voxel Viper - A 3D Snake Adventure built with Next.js and Three.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main} style={{ 
        padding: '0',
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          height: '40px', // Small header
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          backgroundColor: '#111'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.2rem',
            color: '#fff',
            fontWeight: 'normal'
          }}>
            Voxel Viper
          </h2>
        </div>
        
        <div className={styles.gameContainer} style={{
          boxShadow: 'none',
          borderRadius: '0',
          overflow: 'hidden',
          flexGrow: 1,
          width: '100%',
          height: 'calc(100vh - 40px)' // Full height minus header
        }}>
          <SnakeGame />
        </div>
      </main>
    </div>
  )
}