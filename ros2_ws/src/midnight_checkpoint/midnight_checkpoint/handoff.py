def should_start_drone(status: object) -> bool:
    return (
        isinstance(status, dict)
        and status.get("source") == "on-chain"
        and status.get("status") == "verified"
        and status.get("droneId") == "MS-01"
    )
