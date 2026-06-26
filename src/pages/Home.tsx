import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import './Home.css'

export default function Home() {
  useSeo({
    title: 'Home',
    description: 'Credence — on-chain economic identity on Stellar. Stake USDC as a programmable reputation bond.',
  })

  return (
    <div className="home">
      <div>
        <h1 className="home__title">Credence — Economic Trust</h1>
        <p className="home__description">
          On-chain economic identity on Stellar. Stake USDC as a programmable reputation bond.
        </p>
      </div>
      <div className="home__ctaRow">
        <Link to="/bond" role="button" className="home__cta home__cta--primary">
          Create bond
        </Link>
        <Link to="/trust" role="button" className="home__cta home__cta--secondary">
          View trust score
        </Link>
      </div>
    </div>
  )
}
