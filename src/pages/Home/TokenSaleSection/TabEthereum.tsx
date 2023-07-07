import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Box, Button, Grid, Stack, TextField, Typography } from "@mui/material";
import { grey } from "@mui/material/colors";
import { useAccount, useDisconnect, useNetwork, usePrepareSendTransaction, useSendTransaction, useSwitchNetwork, useWaitForTransaction } from "wagmi";
import { useDebounce } from "use-debounce";
import { parseEther } from "viem";
import { toast } from "react-toastify";
import { Icon } from "@iconify/react";
import { useWeb3Modal } from "@web3modal/react";
import useLoading from "../../../hooks/useLoading";
import { CONTRACT_ADDRESS, REGEX_NUMBER_VALID } from "../../../utils/constants";
import api from "../../../utils/api";

// ---------------------------------------------------------------------------------------

const TOKEN_PRICE_IN_ETHEREUM = process.env.REACT_APP_TOKEN_PRICE_IN_ETHEREUM ? Number(process.env.REACT_APP_TOKEN_PRICE_IN_ETHEREUM) : 0.00052
const CHAIN_ID = process.env.REACT_APP_CHAIN_ID ? Number(process.env.REACT_APP_CHAIN_ID) : 1;

// ---------------------------------------------------------------------------------------

interface IProps {
  balance: number;
  remainedTokenAmount: number;
}

// ---------------------------------------------------------------------------------------

export default function TabEthereum({ balance, remainedTokenAmount }: IProps) {
  const { openLoading, closeLoading } = useLoading()
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect()
  const { open } = useWeb3Modal()
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()

  const [sellAmount, setSellAmount] = useState<string>('0');
  const [buyAmount, setBuyAmount] = useState<string>('0');
  const [debouncedSellAmount] = useDebounce<string>(sellAmount, 500);

  const claimStopped = useMemo<boolean>(() => {
    const _buyAmount = Number(buyAmount || '0');
    if (remainedTokenAmount >= _buyAmount) {
      return false;
    }
    return true;
  }, [buyAmount, remainedTokenAmount]);

  /* ----------------- Send Ethereum from the wallet to the contract ------------------ */
  const { config } = usePrepareSendTransaction({
    to: CONTRACT_ADDRESS,
    value: debouncedSellAmount ? parseEther(`${Number(debouncedSellAmount)}`) : undefined
  });

  const { data, sendTransaction } = useSendTransaction(config);

  const { isLoading } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      api.post('invest/invest', {
        investor: address,
        fundTypeId: 1,
        fundAmount: Number(debouncedSellAmount),
        tokenAmount: Number(buyAmount)
      }).then(response => {
        closeLoading();
        toast.success('Transaction completed.')
      }).catch(error => {
        closeLoading();
        toast.error('Transaction failed.')
      });
    }
  });
  const handlePurchase = () => {
    sendTransaction?.();
  };
  /* --------------------------------------------------------------------------------- */

  //  Input sell amount
  const handleSellAmount = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    if (value.match(REGEX_NUMBER_VALID)) {
      setSellAmount(value);
      setBuyAmount(String(Number(value) / TOKEN_PRICE_IN_ETHEREUM));
    }
  };

  //  Input buy amount
  const handleBuyAmount = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    if (value.match(REGEX_NUMBER_VALID)) {
      setBuyAmount(value);
      setSellAmount(String(Number(value) * TOKEN_PRICE_IN_ETHEREUM));
    }
  };

  useEffect(() => {
    if (isLoading) {
      openLoading();
    }
  }, [isLoading]);

  return (
    <Stack alignItems="center" spacing={4}>
      {/* <Typography color={grey[100]}>ETH balance: <Typography component="span" fontWeight={700}>{balance.toFixed(4)}</Typography></Typography> */}
      <Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Selling"
              id="sellAmount"
              name="sellAmount"
              placeholder="0"
              InputProps={{
                endAdornment: (
                  <Box
                    component="img"
                    src="https://cryptologos.cc/logos/ethereum-eth-logo.png?v=025"
                    alt="Ethereum"
                    width={32}
                  />
                )
              }}
              value={sellAmount}
              onChange={handleSellAmount}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Buying"
              id="buyAmount"
              name="buyAmount"
              placeholder="0"
              InputProps={{
                endAdornment: (
                  <Box
                    component="img"
                    src="/logo192.png"
                    alt="Soctty"
                    width={32}
                  />
                )
              }}
              value={buyAmount}
              onChange={handleBuyAmount}
            />
          </Grid>
        </Grid>
      </Box>
      <Stack display="grid" alignItems="center" spacing={1}>
        {isConnected ? chain?.id === CHAIN_ID ? (
          <>
            <Button
              variant="contained"
              sx={{ borderRadius: 9999 }}
              disabled={!sendTransaction || claimStopped}
              onClick={handlePurchase}
            >Buy Now</Button>
            <Button
              variant="outlined"
              sx={{ borderRadius: 9999 }}
              onClick={() => disconnect()}
              endIcon={<Icon icon="heroicons-outline:logout" />}
            >
              {address?.slice(0, 7)}...{address?.slice(-5)}
            </Button>
          </>
        ) : (
          <Button variant="contained" sx={{ borderRadius: 9999 }} onClick={() => switchNetwork?.(CHAIN_ID)}>
            Switch to Ethereum
          </Button>
        ) : (
          <Button
            variant="contained"
            sx={{ borderRadius: 9999 }}
            onClick={() => open()}
          >Buy Now</Button>
        )}
      </Stack>
    </Stack>
  )
}