else if (chainId == CONFLUX_MAINNET_ID) {
    return {
      factoryAddress: "0x62aa0294cb42aae39b7772313eadfa5d489146ec",
      stablecoinWrappedNativePoolAddress:
        "0xcbed98f0066f5f3d60b28f4bd241a6ea302c2023", // WCFX-USDC 0.05% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: "0x14b2D3bC65e74DAE1030EAFd8ac30c533c976A9b", // WCFX
      minimumNativeLocked: BigDecimal("1"),
      stablecoinAddresses: [
        "0x6963EfED0aB40F6C3d7BdA44A05dcf1437C44372", // USDC
        "0xfe97E85d13ABD9c1c33384E796F10B73905637cE", // USDT
      ],
      whitelistTokens: [
        "0x14b2D3bC65e74DAE1030EAFd8ac30c533c976A9b", // WCFX
        "0x6963EfED0aB40F6C3d7BdA44A05dcf1437C44372", // USDC
        "0xfe97E85d13ABD9c1c33384E796F10B73905637cE", // USDT
      ],
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
      tokensToSkip: [],
    };
  } else {
    throw new Error("Unsupported Network");
  }