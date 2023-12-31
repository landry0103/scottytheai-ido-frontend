import { ChangeEvent, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Grid, Stack } from "@mui/material";
import { mainnet, useAccount, useDisconnect, useNetwork, usePrepareSendTransaction, useSendTransaction, useSwitchNetwork, useWaitForTransaction } from "wagmi";
import { useDebounce } from "use-debounce";
import { parseEther } from "viem";
import { toast } from "react-toastify";
import { Icon } from "@iconify/react";
import { useWeb3Modal } from "@web3modal/react";
import { grey } from "@mui/material/colors";
import { bsc } from "wagmi/chains";
import { CONTRACT_ADDRESS, IN_PROGRESS, REGEX_NUMBER_VALID } from "../../../../utils/constants";
import api from "../../../../utils/api";
import { TextField } from "../../../../components/styledComponents";
import { IInvestedToken, ISaleStage } from "../../../../utils/interfaces";

// ---------------------------------------------------------------------------------------

interface IProps {
  remainedTokenAmount: number;
  scottyPriceInToken: number;
  investedToken: IInvestedToken;
  currentSaleStage: ISaleStage
}

// ---------------------------------------------------------------------------------------

export default function TabEthereum({ remainedTokenAmount, scottyPriceInToken, currentSaleStage, investedToken }: IProps) {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect()
  const { open } = useWeb3Modal()
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()

  //  ------------------------------------------------------------------------

  const [sellAmount, setSellAmount] = useState<string>('0');
  const [buyAmount, setBuyAmount] = useState<string>('0');
  const [debouncedSellAmount] = useDebounce<string>(sellAmount, 500);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  //  ------------------------------------------------------------------------

  const claimStopped = useMemo<boolean>(() => {
    const _buyAmount = Number(buyAmount || '0');
    if (remainedTokenAmount >= _buyAmount) {
      return false;
    }
    return true;
  }, [buyAmount, remainedTokenAmount]);

  const sellAmountInNumberType = useMemo<string>(() => {
    if (sellAmount[0] === '0') {
      if (sellAmount[1] !== '.')
        return `${Number(sellAmount)}`
    }
    return sellAmount
  }, [sellAmount])

  const buyAmountInNumberType = useMemo<string>(() => {
    if (buyAmount[0] === '0') {
      if (buyAmount[1] !== '.')
        return `${Number(buyAmount)}`
    }
    return buyAmount
  }, [buyAmount])

  const chainId = useMemo<number>(() => {
    if (investedToken.id === 3) {
      return bsc.id
    }
    return mainnet.id
  }, [investedToken])

  /* ----------------- Send Ethereum from the wallet to the contract ------------------ */
  const { config } = usePrepareSendTransaction({
    to: CONTRACT_ADDRESS,
    chainId,
    value: debouncedSellAmount ? parseEther(`${Number(debouncedSellAmount)}`) : undefined,
    onError: (error) => {
      const errorObject = JSON.parse(JSON.stringify(error))
      setErrorMessage(errorObject.cause.reason)
    }
  });
  const { data, sendTransaction: buy } = useSendTransaction({
    ...config, onError: () => {
      setLoading(false)
    }
  });
  useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      api.post('/ido/invest', {
        investorWalletAddress: address,
        investedTokenId: investedToken.id,
        investedTokenAmount: Number(debouncedSellAmount),
        scottyAmount: Number(buyAmount),
        saleStageId: currentSaleStage.id
      }).then(() => {
        toast.success('Transaction completed.')
        setLoading(false)
      }).catch(error => {
        const errorObject = JSON.parse(JSON.stringify(error))
        console.log('>>>>>>>>>> errorObject => ', errorObject)
        setLoading(false)
        toast.error('Transaction failed.')
      });
    },
    onError: (error) => {
      const errorObject = JSON.parse(JSON.stringify(error))
      setErrorMessage(errorObject.cause.reason)
      setLoading(false)
      toast.error(errorObject.cause.reason)
    }
  });

  /* --------------------------------------------------------------------------------- */

  //  Input sell amount
  const handleSellAmount = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    if (value.match(REGEX_NUMBER_VALID)) {
      setSellAmount(value);
      setBuyAmount(String(Number(value) / scottyPriceInToken));
    }
  };

  //  Input buy amount
  const handleBuyAmount = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    if (value.match(REGEX_NUMBER_VALID)) {
      setBuyAmount(value);
      setSellAmount(String(Number(value) * scottyPriceInToken));
    }
  };

  const handleBuy = () => {
    if (buy) {
      setLoading(true)
      buy()
    } else {
      toast.error(errorMessage)
    }
  }

  //  ------------------------------------------------------------------------

  return (
    <Stack alignItems="center" spacing={4}>
      {/* <Typography color={grey[100]}>ETH balance: <Typography component="span" fontWeight={700}>{balance.toFixed(4)}</Typography></Typography> */}
      <Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Selling"
              id="sellAmount"
              name="sellAmount"
              placeholder="0"
              InputProps={{
                endAdornment: (
                  <Box
                    component="img"
                    src={investedToken.img_src}
                    alt={investedToken.token_name}
                    width={32}
                  />
                )
              }}
              value={sellAmountInNumberType}
              onChange={handleSellAmount}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Buying"
              id="buyAmount"
              name="buyAmount"
              placeholder="0"
              InputProps={{
                endAdornment: (
                  <Box
                    component="img"
                    src="/logo.svg"
                    alt="Soctty"
                    width={32}
                  />
                )
              }}
              value={buyAmountInNumberType}
              onChange={handleBuyAmount}
            />
          </Grid>
        </Grid>
      </Box>
      <Stack display="grid" alignItems="center" spacing={1}>
        {isConnected ? chain?.id === chainId ? (
          <>
            <Button
              variant="contained"
              sx={{ borderRadius: 9999, bgcolor: grey[900], px: 4 }}
              disabled={loading || claimStopped}
              onClick={handleBuy}
              endIcon={loading ? <CircularProgress /> : <></>}
            >
              {loading ? IN_PROGRESS : 'Buy Now'}
            </Button>
            <Button
              variant="contained"
              sx={{ borderRadius: 9999, bgcolor: grey[900] }}
              onClick={() => disconnect()}
              endIcon={<Icon icon="heroicons-outline:logout" />}
            >
              {address?.slice(0, 7)}...{address?.slice(-5)}
            </Button>
          </>
        ) : (
          <Button variant="contained" sx={{ borderRadius: 9999, bgcolor: grey[900] }} onClick={() => switchNetwork?.(chainId)}>
            Switch to {investedToken.token_name}
          </Button>
        ) : (
          <Button
            variant="contained"
            sx={{ borderRadius: 9999, bgcolor: grey[900], px: 4 }}
            onClick={() => open()}
          >Connect Wallet</Button>
        )}
      </Stack>
    </Stack>
  )
}