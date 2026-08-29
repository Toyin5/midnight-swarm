from midnight_checkpoint.handoff import should_start_drone


def test_starts_only_from_finalized_ms01_chain_state() -> None:
    assert should_start_drone({"droneId": "MS-01", "status": "verified", "source": "on-chain"})
    assert not should_start_drone({"droneId": "MS-01", "status": "pending", "source": "on-chain"})
    assert not should_start_drone({"droneId": "MS-01", "status": "verified", "source": "local"})
    assert not should_start_drone({"droneId": "MS-02", "status": "verified", "source": "on-chain"})
