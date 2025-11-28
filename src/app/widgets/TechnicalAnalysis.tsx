import Panel from 'app/components/Panel';
import { type } from 'app/utils/Schema';
import { Vector2 } from 'app/utils/Vector2';
import { WidgetProps, WidgetType } from 'app/Widget';
import React, { useEffect, useState } from 'react';
import { defineMessages } from 'react-intl';

const messages = defineMessages({
	title: {
		id: 'widget.technicalanalysis.title',
		defaultMessage: "Technical Analysis",
		description: "Technical Analysis Widget",
	},
	description: {
		id: 'widget.technicalanalysis.description',
		defaultMessage: "Technical indicators and signals for multiple instruments",
	},
	apiKey: {
		id: 'widget.technicalanalysis.apiKey',
		defaultMessage: "API Key (Twelve Data)",
		description: "API key for Twelve Data",
	},
	apiKeyHelp: {
		id: 'widget.technicalanalysis.apiKeyHelp',
		defaultMessage: "Get free API key at twelvedata.com (800 requests/day)",
	},
	instruments: {
		id: 'widget.technicalanalysis.instruments',
		defaultMessage: "Instruments",
	},
	instrumentsHelp: {
		id: 'widget.technicalanalysis.instrumentsHelp',
		defaultMessage: "Comma-separated symbols. Free tier: Crypto, Forex, US stocks (e.g., BTC/USD,ETH/USD,XAU/USD,EUR/USD,AAPL)",
	},
	timeframe: {
		id: 'widget.technicalanalysis.timeframe',
		defaultMessage: "Timeframe",
	},
	refreshInterval: {
		id: 'widget.technicalanalysis.refreshInterval',
		defaultMessage: "Refresh Interval (minutes)",
	},
	timeframe1min: {
		id: 'widget.technicalanalysis.timeframe.1min',
		defaultMessage: "1 Minute",
	},
	timeframe5min: {
		id: 'widget.technicalanalysis.timeframe.5min',
		defaultMessage: "5 Minutes",
	},
	timeframe15min: {
		id: 'widget.technicalanalysis.timeframe.15min',
		defaultMessage: "15 Minutes",
	},
	timeframe30min: {
		id: 'widget.technicalanalysis.timeframe.30min',
		defaultMessage: "30 Minutes",
	},
	timeframe1h: {
		id: 'widget.technicalanalysis.timeframe.1h',
		defaultMessage: "1 Hour",
	},
	timeframe4h: {
		id: 'widget.technicalanalysis.timeframe.4h',
		defaultMessage: "4 Hours",
	},
	timeframe1day: {
		id: 'widget.technicalanalysis.timeframe.1day',
		defaultMessage: "Daily",
	},
	timeframe1week: {
		id: 'widget.technicalanalysis.timeframe.1week',
		defaultMessage: "Weekly",
	},
});

interface Instrument {
	symbol: string;
	price: number;
	change: number;
	changePercent: number;
	signals: {
		ma: Signal;
		rsi: Signal;
		macd: Signal;
		overall: Signal;
	};
	indicators: {
		rsi: number;
		ma20: number;
		ma50: number;
		ma200: number;
	};
}

type Signal = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

interface TechnicalAnalysisProps {
	apiKey: string;
	instruments: string;
	timeframe: string;
	refreshInterval: number;
}

// Technical Indicator Calculations
class TechnicalIndicators {
	static calculateSMA(prices: number[], period: number): number {
		if (prices.length < period) return 0;
		const slice = prices.slice(-period);
		const sum = slice.reduce((a, b) => a + b, 0);
		return sum / period;
	}

	static calculateEMA(prices: number[], period: number): number {
		if (prices.length < period) return 0;
		const multiplier = 2 / (period + 1);
		let ema = this.calculateSMA(prices.slice(0, period), period);

		for (let i = period; i < prices.length; i++) {
			ema = (prices[i] - ema) * multiplier + ema;
		}
		return ema;
	}

	static calculateRSI(prices: number[], period: number = 14): number {
		if (prices.length < period + 1) return 50;

		let gains = 0;
		let losses = 0;

		for (let i = prices.length - period; i < prices.length; i++) {
			const change = prices[i] - prices[i - 1];
			if (change > 0) gains += change;
			else losses += Math.abs(change);
		}

		const avgGain = gains / period;
		const avgLoss = losses / period;

		if (avgLoss === 0) return 100;
		const rs = avgGain / avgLoss;
		return 100 - (100 / (1 + rs));
	}

	static calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
		const ema12 = this.calculateEMA(prices, 12);
		const ema26 = this.calculateEMA(prices, 26);
		const macd = ema12 - ema26;

		// For signal line, we'd need MACD history, simplified here
		const signal = macd * 0.9; // Simplified
		const histogram = macd - signal;

		return { macd, signal, histogram };
	}

	static getSignalFromRSI(rsi: number): Signal {
		if (rsi < 30) return 'STRONG_BUY';
		if (rsi < 40) return 'BUY';
		if (rsi > 70) return 'STRONG_SELL';
		if (rsi > 60) return 'SELL';
		return 'NEUTRAL';
	}

	static getSignalFromMA(price: number, ma20: number, ma50: number, ma200: number): Signal {
		const above20 = price > ma20;
		const above50 = price > ma50;
		const above200 = price > ma200;

		const bullishCount = [above20, above50, above200].filter(Boolean).length;

		if (bullishCount === 3) return 'STRONG_BUY';
		if (bullishCount === 2) return 'BUY';
		if (bullishCount === 1) return 'SELL';
		if (bullishCount === 0) return 'STRONG_SELL';
		return 'NEUTRAL';
	}

	static getSignalFromMACD(histogram: number): Signal {
		if (histogram > 0.5) return 'STRONG_BUY';
		if (histogram > 0) return 'BUY';
		if (histogram < -0.5) return 'STRONG_SELL';
		if (histogram < 0) return 'SELL';
		return 'NEUTRAL';
	}

	static getOverallSignal(signals: Signal[]): Signal {
		const scores: number[] = signals.map(s => {
			switch (s) {
				case 'STRONG_BUY': return 2;
				case 'BUY': return 1;
				case 'NEUTRAL': return 0;
				case 'SELL': return -1;
				case 'STRONG_SELL': return -2;
			}
		});

		const avgScore: number = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

		if (avgScore > 1.5) return 'STRONG_BUY';
		if (avgScore > 0.5) return 'BUY';
		if (avgScore < -1.5) return 'STRONG_SELL';
		if (avgScore < -0.5) return 'SELL';
		return 'NEUTRAL';
	}
}

function TechnicalAnalysis(props: WidgetProps<TechnicalAnalysisProps>) {
	const [instruments, setInstruments] = useState<Instrument[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const symbols = props.props.instruments.split(',').map(s => s.trim()).filter(Boolean);

	useEffect(() => {
		const fetchData = async () => {
			if (!props.props.apiKey || props.props.apiKey.trim() === '') {
				setError('⚠️ Please add your Twelve Data API key in widget settings. Get free key at twelvedata.com');
				setLoading(false);
				return;
			}

			if (symbols.length === 0) {
				setError('Please add instruments in widget settings (e.g., XAUUSD,US30,NAS100)');
				setLoading(false);
				return;
			}

			setLoading(true);
			setError(null);

			try {
				const instrumentData: Instrument[] = [];

				for (const symbol of symbols) {
					try {
						// Fetch time series data from Twelve Data
						const response = await fetch(
							`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${props.props.timeframe}&outputsize=200&apikey=${props.props.apiKey}`
						);

						if (!response.ok) {
							throw new Error(`Failed to fetch ${symbol}`);
						}

						const data = await response.json();

						if (data.status === 'error') {
								continue;
						}

						if (!data.values || data.values.length === 0) {
								continue;
						}

						// Extract prices
						const prices = data.values.map((v: any) => parseFloat(v.close));
						const currentPrice = prices[0];
						const previousPrice = prices[1];
						const change = currentPrice - previousPrice;
						const changePercent = (change / previousPrice) * 100;

						// Calculate indicators
						const rsi = TechnicalIndicators.calculateRSI(prices.reverse());
						const ma20 = TechnicalIndicators.calculateSMA(prices, 20);
						const ma50 = TechnicalIndicators.calculateSMA(prices, 50);
						const ma200 = TechnicalIndicators.calculateSMA(prices, 200);
						const macd = TechnicalIndicators.calculateMACD(prices);

						// Get signals
						const rsiSignal = TechnicalIndicators.getSignalFromRSI(rsi);
						const maSignal = TechnicalIndicators.getSignalFromMA(currentPrice, ma20, ma50, ma200);
						const macdSignal = TechnicalIndicators.getSignalFromMACD(macd.histogram);
						const overallSignal = TechnicalIndicators.getOverallSignal([rsiSignal, maSignal, macdSignal]);

						instrumentData.push({
							symbol,
							price: currentPrice,
							change,
							changePercent,
							signals: {
								ma: maSignal,
								rsi: rsiSignal,
								macd: macdSignal,
								overall: overallSignal,
							},
							indicators: {
								rsi,
								ma20,
								ma50,
								ma200,
							},
						});
					} catch (err) {
						// Silently skip failed symbols
					}
				}

				setInstruments(instrumentData);
				setLoading(false);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to fetch data');
				setLoading(false);
			}
		};

		fetchData();

		// Set up auto-refresh
		const interval = setInterval(fetchData, props.props.refreshInterval * 60 * 1000);
		return () => clearInterval(interval);
	}, [props.props.apiKey, props.props.instruments, props.props.timeframe, props.props.refreshInterval]);

	const getSignalColor = (signal: Signal): string => {
		switch (signal) {
			case 'STRONG_BUY': return '#00ff00';
			case 'BUY': return '#90EE90';
			case 'NEUTRAL': return '#FFD700';
			case 'SELL': return '#FFA500';
			case 'STRONG_SELL': return '#ff0000';
		}
	};

	const getSignalLabel = (signal: Signal): string => {
		return signal.replace('_', ' ');
	};

	return (
		<Panel {...props.theme} scrolling={true}>
			<div style={{ padding: '10px', fontSize: '14px' }}>
				<h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Technical Analysis - {props.props.timeframe}</h3>

				{loading && <div>Loading instruments...</div>}
				{error && <div style={{ color: '#ff6b6b' }}>{error}</div>}

				{!loading && !error && instruments.length === 0 && (
					<div style={{ color: '#FFA500' }}>
						⚠️ No data received. Possible issues:<br/>
						• API key might be invalid<br/>
						• Symbols not available in free tier (indices require paid plan)<br/>
						• API rate limit reached<br/>
						<br/>
						Free tier works: BTC/USD, ETH/USD, XAU/USD, EUR/USD, AAPL
					</div>
				)}

				{instruments.map((instrument) => (
					<div key={instrument.symbol} style={{
						marginBottom: '15px',
						padding: '10px',
						background: 'rgba(255,255,255,0.05)',
						borderRadius: '5px'
					}}>
						<div style={{
							display: 'flex',
							justifyContent: 'space-between',
							marginBottom: '8px',
							fontWeight: 'bold'
						}}>
							<span>{instrument.symbol}</span>
							<span style={{ color: instrument.change >= 0 ? '#00ff00' : '#ff0000' }}>
								${instrument.price.toFixed(2)} ({instrument.changePercent >= 0 ? '+' : ''}{instrument.changePercent.toFixed(2)}%)
							</span>
						</div>

						<div style={{ fontSize: '12px', marginBottom: '8px' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
								<span>RSI(14): {instrument.indicators.rsi.toFixed(2)}</span>
								<span style={{ color: getSignalColor(instrument.signals.rsi) }}>
									{getSignalLabel(instrument.signals.rsi)}
								</span>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
								<span>Moving Averages</span>
								<span style={{ color: getSignalColor(instrument.signals.ma) }}>
									{getSignalLabel(instrument.signals.ma)}
								</span>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', opacity: 0.7 }}>
								<span style={{ paddingLeft: '10px' }}>MA(20): ${instrument.indicators.ma20.toFixed(2)}</span>
								<span>MA(50): ${instrument.indicators.ma50.toFixed(2)}</span>
							</div>
						</div>

						<div style={{
							padding: '8px',
							background: 'rgba(0,0,0,0.2)',
							borderRadius: '3px',
							textAlign: 'center',
							color: getSignalColor(instrument.signals.overall),
							fontWeight: 'bold'
						}}>
							OVERALL: {getSignalLabel(instrument.signals.overall)}
						</div>
					</div>
				))}
			</div>
		</Panel>
	);
}

const widget: WidgetType<TechnicalAnalysisProps> = {
	Component: TechnicalAnalysis,
	title: messages.title,
	description: messages.description,
	defaultSize: new Vector2(6, 8),
	initialProps: {
		apiKey: '',
		instruments: 'BTC/USD,ETH/USD,XAU/USD,EUR/USD,AAPL',
		timeframe: '1h',
		refreshInterval: 5,
	},
	schema: {
		apiKey: type.string(messages.apiKey, messages.apiKeyHelp),
		instruments: type.string(messages.instruments, messages.instrumentsHelp),
		timeframe: type.select(
			{
				'1min': '1min',
				'5min': '5min',
				'15min': '15min',
				'30min': '30min',
				'1h': '1h',
				'4h': '4h',
				'1day': '1day',
				'1week': '1week',
			},
			{
				'1min': messages.timeframe1min,
				'5min': messages.timeframe5min,
				'15min': messages.timeframe15min,
				'30min': messages.timeframe30min,
				'1h': messages.timeframe1h,
				'4h': messages.timeframe4h,
				'1day': messages.timeframe1day,
				'1week': messages.timeframe1week,
			},
			messages.timeframe
		),
		refreshInterval: type.number(messages.refreshInterval, undefined, 1, 60),
	},
};

export default widget;
