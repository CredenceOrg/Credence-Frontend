import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import PageHeader from '../components/PageHeader'
import './Home.css'

export default function Home() {
  useSeo({
    title: 'Home',
    description:
      'Credence — on-chain economic identity on Stellar. Stake USDC as a programmable reputation bond and build verifiable trust.',
  })

  return (
    <div className="home">
      <PageHeader
        title="Credence — Economic Trust"
        description="On-chain economic identity on Stellar. Stake USDC as a programmable reputation bond."
      />
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
